import base64
from app.core.config import settings
from app.services import github


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
    routes = {
        ("GET", repo): {"default_branch": "main", "html_url": "https://github.com/acme/hr-portal"},
        ("GET", f"{repo}/git/ref/heads/main"): {"object": {"sha": "abc123def456"}},
        ("GET", f"{repo}/git/trees/main"): {
            "tree": [
                {"path": "app/users.py", "type": "blob"},
                {"path": "README.md", "type": "blob"},
            ]
        },
    }
    if (method, path) in routes:
        return routes[(method, path)]
    if path in files:
        return files[path]
    raise AssertionError(f"unexpected GitHub call {method} {path}")


def register(client, email, first="Nina"):
    response = client.post(
        "/api/auth/register",
        json={
            "first_name": first,
            "last_name": "Kim",
            "email": email,
            "password": "Password123!",
        },
    )
    return {"Authorization": "Bearer " + response.json()["access_token"]}


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
    test = client.get(f"/api/test-cases/{test_id}", headers=auth).json()
    assert test["ai_source"]["source_commit"] == "abc123def456"

    current = client.get(
        f"/api/ai-generator/projects/{project['id']}/change-suggestions",
        headers=auth,
    )
    assert current.status_code == 200
    assert current.json()["stale_story_ids"] == []

    def newer_github(method, path, **kwargs):
        if path.endswith("/git/ref/heads/main"):
            return {"object": {"sha": "fff999aaa111"}}
        return fake_github(method, path, **kwargs)

    monkeypatch.setattr(github, "call", newer_github)
    stale = client.get(
        f"/api/ai-generator/projects/{project['id']}/change-suggestions",
        headers=auth,
    )
    assert stale.json()["stale_story_ids"] == [issue_id]
    assert test_id in stale.json()["stale_test_case_ids"]
    assert stale.json()["current_commit"] == "fff999aaa111"


def test_outsider_cannot_generate(client, auth, monkeypatch):
    project = project_with_repo(client, auth, monkeypatch)
    outsider = register(client, "out@example.com", "Omar")
    denied = client.post(
        "/api/ai-generator/generate",
        headers=outsider,
        json={"project_id": project["id"]},
    )
    assert denied.status_code == 404
