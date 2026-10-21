import httpx
import pytest
from app.core.config import settings
from app.services import github


class FakeGitHub:
    """Answers GitHub API calls from a table of (method, path) -> (status, json)."""

    def __init__(self):
        self.routes = {}
        self.calls = []

    def on(self, method, path, status=200, body=None):
        self.routes[(method, path)] = (status, body if body is not None else {})

    def __call__(self, method, url, **kwargs):
        path = url.removeprefix(github.GITHUB_API)
        self.calls.append((method, path, kwargs.get("json"), kwargs.get("params")))
        status, body = self.routes.get((method, path), (404, {"message": "Not Found"}))
        return httpx.Response(status, json=body)


@pytest.fixture
def gh(monkeypatch):
    fake = FakeGitHub()
    monkeypatch.setattr(settings, "github_token", "test-token")
    monkeypatch.setattr(github, "_send", fake)
    return fake


def register(client, email, first):
    token = client.post(
        "/api/auth/register",
        json={
            "first_name": first,
            "last_name": "Kim",
            "email": email,
            "password": "Password123!",
        },
    ).json()["access_token"]
    return {"Authorization": "Bearer " + token}


REPO = {
    "full_name": "acme/hr-portal",
    "html_url": "https://github.com/acme/hr-portal",
    "description": "HR portal",
    "private": True,
    "default_branch": "main",
}


def pull(number, state="open", merged_at=None):
    return {
        "number": number,
        "title": f"PR {number}",
        "state": state,
        "merged_at": merged_at,
        "draft": False,
        "head": {"ref": "feature/leave"},
        "base": {"ref": "main"},
        "user": {"login": "nina"},
        "html_url": f"https://github.com/acme/hr-portal/pull/{number}",
        "created_at": "2026-10-01T10:00:00Z",
        "updated_at": "2026-10-02T10:00:00Z",
    }


def test_not_configured(client, auth, monkeypatch):
    monkeypatch.setattr(settings, "github_token", "")
    assert client.get("/api/github/status", headers=auth).json() == {
        "configured": False
    }
    assert client.get("/api/github/repos", headers=auth).status_code == 503


def test_link_branches_pulls_and_merge(client, auth, gh):
    p = client.post(
        "/api/projects", headers=auth, json={"key": "HR", "name": "HR"}
    ).json()
    gh.on("GET", "/user/repos", body=[REPO])
    gh.on("GET", "/repos/acme/hr-portal", body=REPO)
    repos = client.get("/api/github/repos", headers=auth).json()
    assert repos[0]["full_name"] == "acme/hr-portal"
    assert repos[0]["linked_projects"] == []
    # Nothing to manage until a repository is linked.
    assert (
        client.get(f"/api/github/projects/{p['id']}/branches", headers=auth).status_code
        == 409
    )

    linked = client.put(
        f"/api/github/projects/{p['id']}/repository",
        headers=auth,
        json={"full_name": "acme/hr-portal"},
    )
    assert linked.status_code == 200, linked.text
    assert linked.json()["github_repo"] == "https://github.com/acme/hr-portal"
    assert client.get("/api/github/repos", headers=auth).json()[0][
        "linked_projects"
    ] == ["HR"]
    assert (
        client.put(
            f"/api/github/projects/{p['id']}/repository",
            headers=auth,
            json={"full_name": "../../user"},
        ).status_code
        == 422
    )

    gh.on(
        "GET",
        "/repos/acme/hr-portal/branches",
        body=[{"name": "main", "commit": {"sha": "abc123"}, "protected": True}],
    )
    data = client.get(f"/api/github/projects/{p['id']}/branches", headers=auth).json()
    assert data["default_branch"] == "main"
    assert data["can_merge"] is True
    assert data["branches"][0] == {"name": "main", "sha": "abc123", "protected": True}

    gh.on("GET", "/repos/acme/hr-portal/git/ref/heads/main", body={"object": {"sha": "abc123"}})
    gh.on("POST", "/repos/acme/hr-portal/git/refs", 201, {"ref": "refs/heads/feature/leave"})
    made = client.post(
        f"/api/github/projects/{p['id']}/branches",
        headers=auth,
        json={"name": "feature/leave", "from_branch": "main"},
    )
    assert made.status_code == 201, made.text
    assert gh.calls[-1][2] == {"ref": "refs/heads/feature/leave", "sha": "abc123"}
    for bad in ["../x", "feature/", "a..b", "has space"]:
        response = client.post(
            f"/api/github/projects/{p['id']}/branches",
            headers=auth,
            json={"name": bad, "from_branch": "main"},
        )
        assert response.status_code == 422, bad

    gh.on(
        "GET",
        "/repos/acme/hr-portal/pulls",
        body=[pull(7), pull(6, "closed", "2026-10-03T00:00:00Z")],
    )
    listed = client.get(
        f"/api/github/projects/{p['id']}/pulls?state=all", headers=auth
    ).json()
    assert [(x["number"], x["state"]) for x in listed] == [(7, "open"), (6, "merged")]
    assert gh.calls[-1][3]["state"] == "all"

    gh.on("POST", "/repos/acme/hr-portal/pulls", 201, pull(8))
    opened = client.post(
        f"/api/github/projects/{p['id']}/pulls",
        headers=auth,
        json={"title": "Leave form", "head": "feature/leave", "base": "main"},
    )
    assert opened.status_code == 201, opened.text
    assert opened.json()["number"] == 8
    same = client.post(
        f"/api/github/projects/{p['id']}/pulls",
        headers=auth,
        json={"title": "x", "head": "main", "base": "main"},
    )
    assert same.status_code == 422

    gh.on(
        "PUT",
        "/repos/acme/hr-portal/pulls/8/merge",
        body={"merged": True, "message": "Pull Request successfully merged", "sha": "def"},
    )
    merged = client.put(
        f"/api/github/projects/{p['id']}/pulls/8/merge",
        headers=auth,
        json={"method": "squash"},
    )
    assert merged.status_code == 200, merged.text
    assert merged.json()["merged"] is True
    assert gh.calls[-1][2] == {"merge_method": "squash"}
    gh.on(
        "PUT",
        "/repos/acme/hr-portal/pulls/9/merge",
        405,
        {"message": "Pull Request is not mergeable"},
    )
    conflict = client.put(
        f"/api/github/projects/{p['id']}/pulls/9/merge", headers=auth, json={}
    )
    assert conflict.status_code == 409
    assert conflict.json()["detail"] == "Pull Request is not mergeable"

    unlinked = client.delete(
        f"/api/github/projects/{p['id']}/repository", headers=auth
    )
    assert unlinked.json()["github_repo"] == ""


def test_github_permissions(client, auth, gh):
    nina = register(client, "nina@example.com", "Nina")
    stranger = register(client, "eve@example.com", "Eve")
    nina_id = client.get("/api/auth/me", headers=nina).json()["id"]
    p = client.post(
        "/api/projects",
        headers=auth,
        json={
            "key": "HR",
            "name": "HR",
            "github_repo": "https://github.com/acme/hr-portal",
        },
    ).json()
    client.post(
        f"/api/projects/{p['id']}/members",
        headers=auth,
        json={"user_ids": [nina_id], "role": "DEVELOPER"},
    )
    gh.on("GET", "/repos/acme/hr-portal", body=REPO)
    gh.on("GET", "/repos/acme/hr-portal/branches", body=[])
    gh.on("PUT", "/repos/acme/hr-portal/pulls/1/merge", body={"merged": True})
    base = f"/api/github/projects/{p['id']}"

    # Employees cannot list repositories or link them.
    assert client.get("/api/github/repos", headers=nina).status_code == 403
    assert (
        client.put(
            f"{base}/repository", headers=nina, json={"full_name": "acme/hr-portal"}
        ).status_code
        == 403
    )
    # Members can see branches; outsiders cannot see the project at all.
    view = client.get(f"{base}/branches", headers=nina)
    assert view.status_code == 200
    assert view.json()["can_merge"] is False
    assert client.get(f"{base}/branches", headers=stranger).status_code == 404
    # Developers cannot merge; a lead can.
    assert client.put(f"{base}/pulls/1/merge", headers=nina, json={}).status_code == 403
    client.post(
        f"/api/projects/{p['id']}/members",
        headers=auth,
        json={"user_ids": [nina_id], "role": "LEAD"},
    )
    assert client.put(f"{base}/pulls/1/merge", headers=nina, json={}).status_code == 200
    # A bad token is reported as a GitHub problem, not as the user's session expiring.
    gh.on("GET", "/repos/acme/hr-portal", 401, {"message": "Bad credentials"})
    assert client.get(f"{base}/branches", headers=auth).status_code == 502
