import base64
import json
import httpx
from app.core.config import settings
from app.services import github
from tests.conftest import create_user


LOGIN_SOURCE = """
def create_user(role):
    allowed = ["Candidate Internal", "Recruiter", "Application Admin"]
    if role not in allowed:
        raise ValueError("unauthorized role")
    return {"role": role}
"""


def fake_github(method, path, **kwargs):
    repo = "/repos/acme/hr-portal"
    files = {
        f"{repo}/contents/app/users.py": {
            "encoding": "base64",
            "content": base64.b64encode(LOGIN_SOURCE.encode()).decode(),
        }
    }
    tree = {
        "tree": [
            {"path": "app/users.py", "type": "blob"},
            {"path": "README.md", "type": "blob"},
        ]
    }
    routes = {
        ("GET", repo): {
            "default_branch": "main",
            "html_url": "https://github.com/acme/hr-portal",
        },
        ("GET", f"{repo}/git/ref/heads/main"): {"object": {"sha": "abc123def456"}},
        ("GET", f"{repo}/git/trees/main"): tree,
        ("GET", f"{repo}/git/trees/abc123def456"): tree,
    }
    if (method, path) in routes:
        return routes[(method, path)]
    if path in files:
        return files[path]
    raise AssertionError(f"unexpected GitHub call {method} {path}")


def project_with_repo(client, auth, monkeypatch):
    monkeypatch.setattr(settings, "github_token", "test-token")
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(github, "call", fake_github)
    return client.post(
        "/api/projects",
        headers=auth,
        json={
            "key": "AIGEN",
            "name": "Generator",
            "github_repo": "https://github.com/acme/hr-portal",
        },
    ).json()


def test_generator_requires_linked_repo(client, auth):
    project = client.post(
        "/api/projects", headers=auth, json={"key": "NONE", "name": "No repo"}
    ).json()
    blocked = client.post(
        "/api/ai-generator/generate",
        headers=auth,
        json={"project_id": project["id"], "output_type": "BOTH"},
    )
    assert blocked.status_code == 409


def test_generate_review_save_and_trace_commit(client, auth, monkeypatch):
    project = project_with_repo(client, auth, monkeypatch)
    status = client.get("/api/ai-generator/status", headers=auth)
    assert status.status_code == 200
    assert status.json()["github_configured"] is True
    assert status.json()["openai_configured"] is False

    modules = client.get(
        f"/api/ai-generator/projects/{project['id']}/modules", headers=auth
    )
    assert modules.status_code == 200, modules.text
    paths = {item["path"] for item in modules.json()}
    assert "" in paths
    assert "app" in paths

    draft = client.post(
        "/api/ai-generator/generate",
        headers=auth,
        json={
            "project_id": project["id"],
            "module_path": "app",
            "output_type": "BOTH",
            "coverage": ["POSITIVE", "VALIDATION"],
        },
    )
    assert draft.status_code == 200, draft.text
    body = draft.json()
    assert body["repository"] == "acme/hr-portal"
    assert body["source_commit"] == "abc123def456"
    assert body["user_stories"]
    assert body["user_stories"][0]["acceptance_criteria"]
    titles = [test["title"] for test in body["user_stories"][0]["test_cases"]]
    assert any("happy path" in title.lower() for title in titles)
    assert any("validate" in title.lower() for title in titles)

    saved = client.post(
        "/api/ai-generator/save",
        headers=auth,
        json={**body, "selected_story_indexes": [0]},
    )
    assert saved.status_code == 200, saved.text
    issue_id = saved.json()["issue_ids"][0]
    test_id = saved.json()["test_case_ids"][0]
    issue = client.get(f"/api/issues/{issue_id}", headers=auth).json()
    assert issue["ai_source"]["source_commit"] == "abc123def456"
    assert issue["ai_source"]["repository"] == "acme/hr-portal"
    assert issue["ai_source"]["source_kind"] == "DEFAULT"
    assert issue["ai_source"]["source_ref"] == "main"
    test = client.get(f"/api/test-cases/{test_id}", headers=auth).json()
    assert test["ai_source"]["source_commit"] == "abc123def456"
    # The happy path proves the first two criteria only, not every criterion.
    assert len(test["criterion_ids"]) == 2

    url = f"/api/ai-generator/projects/{project['id']}/change-suggestions"
    current = client.get(url, headers=auth)
    assert current.status_code == 200
    assert current.json()["stale_story_ids"] == []

    def newer_github(changed_file):
        def call(method, path, **kwargs):
            if path.endswith("/git/ref/heads/main"):
                return {"object": {"sha": "fff999aaa111"}}
            if path.endswith("/compare/abc123def456...fff999aaa111"):
                return {"files": [{"filename": changed_file}]}
            return fake_github(method, path, **kwargs)

        return call

    # A newer commit that only touches docs leaves the module's items current.
    monkeypatch.setattr(github, "call", newer_github("README.md"))
    assert client.get(url, headers=auth).json()["stale_story_ids"] == []

    monkeypatch.setattr(github, "call", newer_github("app/users.py"))
    stale = client.get(url, headers=auth)
    assert stale.json()["stale_story_ids"] == [issue_id]
    assert test_id in stale.json()["stale_test_case_ids"]
    assert stale.json()["current_commit"] == "fff999aaa111"


def with_routes(extra):
    """fake_github plus extra routes; records every content path read."""
    reads = []

    def call(method, path, **kwargs):
        if path in extra:
            return extra[path]
        if "/contents/" in path:
            reads.append((path.split("/contents/")[1], kwargs["params"]["ref"]))
            return {
                "encoding": "base64",
                "content": base64.b64encode(LOGIN_SOURCE.encode()).decode(),
            }
        return fake_github(method, path, **kwargs)

    return call, reads


def generate(client, auth, project, **body):
    return client.post(
        "/api/ai-generator/generate",
        headers=auth,
        json={"project_id": project["id"], **body},
    )


def test_generate_reads_only_what_a_branch_changed(client, auth, monkeypatch):
    project = project_with_repo(client, auth, monkeypatch)
    repo = "/repos/acme/hr-portal"
    call, reads = with_routes(
        {
            f"{repo}/git/ref/heads/feature/login": {"object": {"sha": "bra9c4"}},
            f"{repo}/compare/abc123def456...bra9c4": {
                "files": [
                    {
                        "filename": "app/login.py",
                        "status": "added",
                        "changes": 40,
                        "patch": "+def login(): ...",
                    },
                    {
                        "filename": "tests/test_login.py",
                        "status": "added",
                        "changes": 90,
                    },
                    {"filename": "app/old.py", "status": "removed", "changes": 10},
                    {"filename": "docs/login.md", "status": "added", "changes": 5},
                ]
            },
        }
    )
    monkeypatch.setattr(github, "call", call)
    draft = generate(client, auth, project, branch="feature/login")
    assert draft.status_code == 200, draft.text
    body = draft.json()
    assert body["source_commit"] == "bra9c4"
    assert (body["source_kind"], body["source_ref"]) == ("BRANCH", "feature/login")
    # Changed source files only, at the branch tip, product code before tests.
    assert reads == [("app/login.py", "bra9c4"), ("tests/test_login.py", "bra9c4")]

    bad = generate(client, auth, project, branch="../main")
    assert bad.status_code == 422


def test_branch_without_changes_reads_its_files(client, auth, monkeypatch):
    project = project_with_repo(client, auth, monkeypatch)
    repo = "/repos/acme/hr-portal"
    call, reads = with_routes(
        {
            f"{repo}/git/ref/heads/release": {"object": {"sha": "rel111"}},
            f"{repo}/compare/abc123def456...rel111": {"files": []},
            f"{repo}/git/trees/rel111": {
                "tree": [{"path": "app/users.py", "type": "blob"}]
            },
        }
    )
    monkeypatch.setattr(github, "call", call)
    body = generate(client, auth, project, branch="release").json()
    assert reads == [("app/users.py", "rel111")]
    assert any("no source changes" in note for note in body["notes"])


def test_generate_reads_pull_request_head(client, auth, monkeypatch):
    project = project_with_repo(client, auth, monkeypatch)
    repo = "/repos/acme/hr-portal"
    files = [
        {
            "filename": "billing/invoice.py",
            "status": "added",
            "changes": 120,
            "patch": "+class Invoice: ...",
        },
        {"filename": "app/users.py", "status": "modified", "changes": 3},
        {"filename": "README.md", "status": "modified", "changes": 1},
    ]
    call, reads = with_routes(
        {
            f"{repo}/pulls/12": {
                "head": {"sha": "prhead77"},
                "title": "Invoices",
                "body": "",
            },
            f"{repo}/pulls/12/files": files,
            f"{repo}/pulls/13": {"head": {"sha": "docs88"}, "title": "Docs"},
            f"{repo}/pulls/13/files": [{"filename": "README.md", "status": "modified"}],
        }
    )
    monkeypatch.setattr(github, "call", call)
    body = generate(client, auth, project, pull_number=12).json()
    assert (body["source_kind"], body["source_ref"], body["source_commit"]) == (
        "PULL",
        "12",
        "prhead77",
    )
    # The PR's own head commit, including a folder main does not have yet.
    assert reads == [("billing/invoice.py", "prhead77"), ("app/users.py", "prhead77")]

    reads.clear()
    generate(client, auth, project, pull_number=12, module_path="app")
    assert reads == [("app/users.py", "prhead77")]

    docs = generate(client, auth, project, pull_number=13)
    assert docs.status_code == 422
    assert "changes no source files" in docs.json()["detail"]

    both = generate(client, auth, project, pull_number=12, branch="main")
    assert both.status_code == 422


def test_generate_reads_one_commit(client, auth, monkeypatch):
    project = project_with_repo(client, auth, monkeypatch)
    repo = "/repos/acme/hr-portal"
    call, reads = with_routes(
        {
            f"{repo}/commits/c0ffee1": {
                "sha": "c0ffee1234567890",
                "commit": {"message": "Add role check"},
                "files": [
                    {"filename": "app/roles.py", "status": "modified", "changes": 8}
                ],
            },
        }
    )
    monkeypatch.setattr(github, "call", call)
    body = generate(client, auth, project, commit="c0ffee1").json()
    assert (body["source_kind"], body["source_commit"]) == (
        "COMMIT",
        "c0ffee1234567890",
    )
    assert reads == [("app/roles.py", "c0ffee1234567890")]
    assert generate(client, auth, project, commit="not-a-sha").status_code == 422


class FakeResponse:
    def __init__(self, status_code, body):
        self.status_code = status_code
        self._body = body

    def json(self):
        return self._body


def test_ai_answer_is_repaired_not_rejected(client, auth, monkeypatch):
    project = project_with_repo(client, auth, monkeypatch)
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    answer = {
        "user_stories": [
            {
                "title": "Restrict roles",
                "priority": "High",
                "story_points": "5",
                "acceptance_criteria": [f"Criterion {i}" for i in range(15)],
                "test_cases": [
                    {
                        "title": "Reject unknown role",
                        "test_type": "Negative",
                        "priority": "critical",
                        "covers": [1, "Criterion 2", 99],
                    },
                ],
            },
            {"description": "no title, dropped"},
        ],
        "notes": ["Roles come from users.py"],
    }
    content = {"choices": [{"message": {"content": json.dumps(answer)}}]}
    monkeypatch.setattr(
        "app.services.ai_generator.httpx.post",
        lambda *a, **k: FakeResponse(200, content),
    )
    body = generate(client, auth, project, module_path="app").json()
    [story] = body["user_stories"]
    assert (story["title"], story["priority"], story["story_points"]) == (
        "Restrict roles",
        "HIGH",
        5,
    )
    assert len(story["acceptance_criteria"]) == 12
    [test] = story["test_cases"]
    assert (test["test_type"], test["priority"], test["criteria"]) == (
        "FUNCTIONAL",
        "CRITICAL",
        [1, 2],
    )
    assert "Roles come from users.py" in body["notes"]
    assert not any("AI draft unavailable" in note for note in body["notes"])


def test_fallback_says_why(client, auth, monkeypatch):
    project = project_with_repo(client, auth, monkeypatch)
    body = generate(client, auth, project).json()
    assert any("OPENAI_API_KEY" in note for note in body["notes"])

    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(
        "app.services.ai_generator.httpx.post",
        lambda *a, **k: FakeResponse(429, {"error": {"message": "quota"}}),
    )
    body = generate(client, auth, project).json()
    assert body["user_stories"]
    assert any("rate limit or quota" in note for note in body["notes"])

    def timeout(*a, **k):
        raise httpx.ReadTimeout("slow")

    monkeypatch.setattr("app.services.ai_generator.httpx.post", timeout)
    body = generate(client, auth, project).json()
    assert any("within 100 seconds" in note for note in body["notes"])


def test_items_follow_their_own_branch(client, auth, monkeypatch):
    project = project_with_repo(client, auth, monkeypatch)
    repo = "/repos/acme/hr-portal"
    branch_head = {"sha": "bra9c4"}
    call, _ = with_routes({})

    def github_call(method, path, **kwargs):
        if path == f"{repo}/git/ref/heads/feature/login":
            return {"object": {"sha": branch_head["sha"]}}
        if path == f"{repo}/compare/abc123def456...bra9c4":
            return {
                "files": [{"filename": "app/login.py", "status": "added", "changes": 4}]
            }
        if path == f"{repo}/compare/bra9c4...bra9c5":
            return {"files": [{"filename": "app/login.py", "status": "modified"}]}
        return call(method, path, **kwargs)

    monkeypatch.setattr(github, "call", github_call)
    draft = generate(client, auth, project, branch="feature/login").json()
    saved = client.post("/api/ai-generator/save", headers=auth, json=draft).json()
    url = f"/api/ai-generator/projects/{project['id']}/change-suggestions"
    # Main is unchanged and so is the branch: not stale, though main differs.
    assert client.get(url, headers=auth).json()["stale_story_ids"] == []
    branch_head["sha"] = "bra9c5"
    assert client.get(url, headers=auth).json()["stale_story_ids"] == saved["issue_ids"]


def test_outsider_cannot_generate(client, auth, monkeypatch):
    project = project_with_repo(client, auth, monkeypatch)
    outsider = create_user(client, auth, "Omar", "Kim", "out@example.com")
    denied = client.post(
        "/api/ai-generator/generate",
        headers=outsider,
        json={"project_id": project["id"]},
    )
    assert denied.status_code == 404


def test_pull_module_picks_folder_with_most_changes(client, auth, monkeypatch):
    project = project_with_repo(client, auth, monkeypatch)
    pulls = {
        7: [
            {"filename": "app/users.py"},
            {"filename": "app/roles.py"},
            {"filename": "README.md"},
        ],
        8: [{"filename": "docs/guide.md"}],
        9: [{"filename": "billing/invoice.py"}],
    }

    def with_pulls(method, path, **kwargs):
        prefix = "/repos/acme/hr-portal/pulls/"
        if method == "GET" and path.startswith(prefix) and path.endswith("/files"):
            return pulls[int(path[len(prefix) : -len("/files")])]
        return fake_github(method, path, **kwargs)

    monkeypatch.setattr(github, "call", with_pulls)
    base = f"/api/ai-generator/projects/{project['id']}/pulls"
    r = client.get(f"{base}/7/module", headers=auth)
    assert r.status_code == 200, r.text
    assert r.json() == {"module_path": "app", "changed_files": 2, "matched_files": 2}
    # Only non-source files changed: fall back to the entire repository.
    r = client.get(f"{base}/8/module", headers=auth)
    assert r.json() == {"module_path": "", "changed_files": 0, "matched_files": 0}
    # Changes in a folder the default branch does not have yet.
    r = client.get(f"{base}/9/module", headers=auth)
    assert r.json() == {"module_path": "", "changed_files": 1, "matched_files": 0}


def big_repo_github(files):
    """A repository whose tree is `files` (path -> source), every file readable."""
    repo = "/repos/acme/hr-portal"
    tree = {
        "tree": [
            {"path": path, "type": "blob", "size": len(body)}
            for path, body in files.items()
        ]
    }
    reads = []

    def call(method, path, **kwargs):
        if path == repo:
            return {
                "default_branch": "main",
                "html_url": "https://github.com/acme/hr-portal",
            }
        if path == f"{repo}/git/ref/heads/main":
            return {"object": {"sha": "abc123def456"}}
        if path.startswith(f"{repo}/git/trees/"):
            return tree
        name = path.removeprefix(f"{repo}/contents/")
        if name in files:
            reads.append(name)
            return {
                "encoding": "base64",
                "content": base64.b64encode(files[name].encode()).decode(),
            }
        raise AssertionError(f"unexpected GitHub call {method} {path}")

    return call, reads


def openai_returning(answer_for):
    """Fake OpenAI: `answer_for(prompt)` builds the model's answer from the request."""
    prompts = []

    def post(url, **kwargs):
        prompt = json.loads(kwargs["json"]["messages"][1]["content"])
        prompts.append(prompt)
        content = json.dumps(answer_for(prompt))
        return FakeResponse(200, {"choices": [{"message": {"content": content}}]})

    return post, prompts


def test_whole_repository_is_read_in_parts_across_every_area(client, auth, monkeypatch):
    project = project_with_repo(client, auth, monkeypatch)
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    body = "x = 1\n" * 2000  # ~12k characters per file
    files = {
        f"src/{area}/file{i}.py": body
        for area in ("billing", "leave", "users", "auth")
        for i in range(12)
    }
    files["tests/test_leave.py"] = body
    call, reads = big_repo_github(files)
    monkeypatch.setattr(github, "call", call)

    def answer(prompt):
        first = prompt["sources"][0]["path"]
        return {
            "user_stories": [
                {
                    "title": f"Capability from {first}",
                    "source_files": [first, "made/up/file.py"],
                    "acceptance_criteria": ["It works"],
                    "test_cases": [{"title": "Positive: works", "covers": [0]}],
                },
                {"title": "Shared story", "acceptance_criteria": ["Same"]},
            ]
        }

    post, prompts = openai_returning(answer)
    monkeypatch.setattr("app.services.ai_generator.httpx.post", post)
    draft = generate(client, auth, project, output_type="BOTH").json()
    # Several parts, each covering real files; every area is read, product code first.
    assert len(prompts) > 1
    assert {path.split("/")[1] for path in reads} == {
        "billing",
        "leave",
        "users",
        "auth",
    }
    assert "tests/test_leave.py" not in reads
    assert all(
        p["outline"] and p["part"].endswith(f"of {len(prompts)}") for p in prompts
    )
    titles = [s["title"] for s in draft["user_stories"]]
    # The story repeated by every part appears once.
    assert titles.count("Shared story") == 1
    assert len(titles) == len(prompts) + 1
    # Stories cite only files that were really sent.
    assert all(
        "made/up/file.py" not in s["source_files"] for s in draft["user_stories"]
    )
    assert draft["user_stories"][0]["source_files"]
    assert any("parts" in note for note in draft["notes"])


def test_stories_only_drops_tests_and_asks_for_none(client, auth, monkeypatch):
    project = project_with_repo(client, auth, monkeypatch)
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    post, prompts = openai_returning(
        lambda prompt: {
            "user_stories": [
                {
                    "title": "Restrict roles",
                    "source_files": ["app/users.py"],
                    "acceptance_criteria": ["Unknown roles are rejected"],
                    "test_cases": [{"title": "Negative: unknown role", "covers": [0]}],
                }
            ]
        }
    )
    monkeypatch.setattr("app.services.ai_generator.httpx.post", post)
    draft = generate(client, auth, project, output_type="USER_STORIES").json()
    [story] = draft["user_stories"]
    assert story["test_cases"] == []
    assert story["source_files"] == ["app/users.py"]
    assert "test_cases" not in json.dumps(prompts[0]["schema"])
    saved = client.post("/api/ai-generator/save", headers=auth, json=draft).json()
    assert saved["test_case_ids"] == []
    issue = client.get(f"/api/issues/{saved['issue_ids'][0]}", headers=auth).json()
    assert "Generated from: app/users.py" in issue["description"]


def test_test_cases_join_existing_stories(client, auth, monkeypatch):
    project = project_with_repo(client, auth, monkeypatch)
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    story = client.post(
        "/api/issues",
        headers=auth,
        json={
            "project_id": project["id"],
            "issue_type": "STORY",
            "summary": "Manage roles",
        },
    ).json()
    for order, text in enumerate(
        ["Admins can assign roles", "Unknown roles are rejected"]
    ):
        client.post(
            f"/api/issues/{story['id']}/acceptance-criteria",
            headers=auth,
            json={"description": text, "order_index": order},
        )

    def answer(prompt):
        [known] = prompt["existing_stories"]
        assert known["acceptance_criteria"][1] == "Unknown roles are rejected"
        return {
            "user_stories": [
                {
                    "existing_story_id": known["id"],
                    "title": "Renamed by the model",
                    "test_cases": [
                        {
                            "title": "Negative: unknown role is rejected",
                            "covers": [1],
                            "steps": [
                                {
                                    "action": "Create a user with role Guest",
                                    "expected_result": "unauthorized role",
                                }
                            ],
                        }
                    ],
                },
                # A new story without tests is not what was asked for.
                {"title": "Story without tests", "acceptance_criteria": ["x"]},
                # An id from another project is ignored, so this becomes a new story.
                {
                    "existing_story_id": 999999,
                    "title": "Audit log",
                    "acceptance_criteria": ["Changes are logged"],
                    "test_cases": [{"title": "Positive: logged", "covers": [0]}],
                },
            ]
        }

    post, _ = openai_returning(answer)
    monkeypatch.setattr("app.services.ai_generator.httpx.post", post)
    draft = generate(
        client, auth, project, output_type="TEST_CASES", coverage=["NEGATIVE"]
    ).json()
    joined, new = draft["user_stories"]
    assert (joined["existing_issue_id"], joined["title"]) == (
        story["id"],
        "Manage roles",
    )
    assert (new["existing_issue_id"], new["title"]) == (None, "Audit log")
    saved = client.post("/api/ai-generator/save", headers=auth, json=draft).json()
    # The existing story gains the test; only the unmatched one is created.
    assert saved["updated_issue_ids"] == [story["id"]]
    assert len(saved["issue_ids"]) == 1 and len(saved["test_case_ids"]) == 2
    criteria = client.get(
        f"/api/issues/{story['id']}/acceptance-criteria", headers=auth
    ).json()
    assert len(criteria) == 2  # no criteria were added to the existing story
    test = client.get(
        f"/api/test-cases/{saved['test_case_ids'][0]}", headers=auth
    ).json()
    assert test["issue_id"] == story["id"]
    assert test["criterion_ids"] == [criteria[1]["id"]]


def test_generator_reads_only_linked_repositories(client, auth, monkeypatch):
    project = project_with_repo(client, auth, monkeypatch)
    assert (
        generate(client, auth, project, repository="acme/hr-portal").status_code == 200
    )
    assert generate(client, auth, project, repository="acme/secret").status_code == 404
    assert (
        client.get(
            f"/api/ai-generator/projects/{project['id']}/modules?repo=acme/secret",
            headers=auth,
        ).status_code
        == 404
    )
