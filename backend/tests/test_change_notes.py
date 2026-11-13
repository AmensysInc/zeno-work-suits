import base64
from urllib.parse import unquote

import json as json_module

from app.core.config import settings
from app.services import github
from tests.test_ai_generator import FakeResponse

REPO = "/repos/acme/hr-portal"
NOTE = """================================================================================
Zeno TeamSuite — Change Summary
Date: 2026-11-13
Topic: Video calls in project chats
================================================================================
1) CHATS — Start or join a project call
Page name : Chats
Route     : /chat?project=<projectId>
Files:
  - frontend/src/app/(app)/chat/page.tsx
  - backend/app/services/calls.py      (NEW)
  - docs/not-in-repo.py
What changed:
  - The chat header has a "Call" button.
TEST IDEAS FOR BA / QA
  - Person A presses Call and joins.
"""
CODE = {
    "frontend/src/app/(app)/chat/page.tsx": "export default function ChatPage() { return 'Call'; }",
    "backend/app/services/calls.py": "def join(project_id):\n    return {'room': f'project-{project_id}'}\n",
    "app/users.py": "def unrelated(): pass\n",
}


def b64(text):
    return {"encoding": "base64", "content": base64.b64encode(text.encode()).decode()}


def fake_github(method, path, **kwargs):
    files = {
        "Changes/2026-11-13-project-video-calls.txt": NOTE,
        "Changes/2026-11-11-session-changes.txt": "Older notes",
        "changes/README.md": "How we write notes",
        "Changes/old/2026-01-01-nested.txt": "nested, not listed",
        "Changes/empty.txt": "   ",
        **CODE,
    }
    tree = {
        "tree": [{"path": p, "type": "blob", "size": len(c)} for p, c in files.items()]
        + [{"path": "Changes", "type": "tree"}]
    }
    routes = {
        ("GET", REPO): {"default_branch": "main", "html_url": "https://github.com/acme/hr-portal"},
        ("GET", f"{REPO}/git/ref/heads/main"): {"object": {"sha": "abc123def456"}},
        ("GET", f"{REPO}/git/trees/main"): tree,
        ("GET", f"{REPO}/git/trees/abc123def456"): tree,
    }
    if (method, path) in routes:
        return routes[(method, path)]
    for name, content in files.items():
        if unquote(path) == f"{REPO}/contents/{name}":
            return b64(content)
    raise AssertionError(f"unexpected GitHub call {method} {path}")


def project(client, auth, monkeypatch, key="NOTES"):
    monkeypatch.setattr(settings, "github_token", "test-token")
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(github, "call", fake_github)
    return client.post(
        "/api/projects",
        headers=auth,
        json={"key": key, "name": "Notes", "github_repo": "https://github.com/acme/hr-portal"},
    ).json()


def test_change_notes_are_listed_newest_first(client, auth, monkeypatch):
    p = project(client, auth, monkeypatch)
    listed = client.get(f"/api/ai-generator/projects/{p['id']}/change-notes", headers=auth)
    assert listed.status_code == 200, listed.text
    assert listed.json() == [
        {"path": "Changes/2026-11-13-project-video-calls.txt", "date": "2026-11-13", "title": "Project video calls"},
        {"path": "Changes/2026-11-11-session-changes.txt", "date": "2026-11-11", "title": "Session changes"},
        {"path": "changes/README.md", "date": "", "title": "README"},
        {"path": "Changes/empty.txt", "date": "", "title": "Empty"},
    ]


def test_change_note_preview_shows_text_and_files_it_names(client, auth, monkeypatch):
    p = project(client, auth, monkeypatch)
    note = client.get(
        f"/api/ai-generator/projects/{p['id']}/change-notes/content",
        headers=auth,
        params={"path": "Changes/2026-11-13-project-video-calls.txt"},
    )
    assert note.status_code == 200, note.text
    body = note.json()
    assert body["title"] == "Project video calls"
    assert "Route     : /chat?project=<projectId>" in body["content"]
    # Only files that exist in the repository are listed, in the order they are named.
    assert body["files"] == ["frontend/src/app/(app)/chat/page.tsx", "backend/app/services/calls.py"]


def test_only_change_notes_can_be_read_through_the_preview(client, auth, monkeypatch):
    p = project(client, auth, monkeypatch)
    url = f"/api/ai-generator/projects/{p['id']}/change-notes/content"
    assert client.get(url, headers=auth, params={"path": "app/users.py"}).status_code == 422
    assert client.get(url, headers=auth, params={"path": "Changes/../app/users.py"}).status_code == 422
    assert client.get(url, headers=auth, params={"path": "Changes/missing.txt"}).status_code == 404
    assert client.get(url, headers=auth, params={"path": "Changes/empty.txt"}).status_code == 422


def test_generate_from_a_change_note_sends_note_and_named_code(client, auth, monkeypatch):
    p = project(client, auth, monkeypatch)
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    sent = {}
    answer = {
        "user_stories": [
            {
                "title": "Start a project call",
                "acceptance_criteria": ["The chat header has a Call button"],
                "source_files": ["backend/app/services/calls.py"],
                "test_cases": [{"title": "Positive: start a call", "covers": [0]}],
            }
        ],
        "notes": [],
    }

    def fake_openai(url, json, headers, timeout):
        sent["rules"] = json["messages"][0]["content"]
        sent["prompt"] = json_module.loads(json["messages"][1]["content"])
        return FakeResponse(200, {"choices": [{"message": {"content": json_module.dumps(answer)}}]})

    monkeypatch.setattr("app.services.ai_generator.httpx.post", fake_openai)
    draft = client.post(
        "/api/ai-generator/generate",
        headers=auth,
        json={
            "project_id": p["id"],
            "change_note": "Changes/2026-11-13-project-video-calls.txt",
            "output_type": "BOTH",
        },
    )
    assert draft.status_code == 200, draft.text
    body = draft.json()
    assert body["source_kind"] == "NOTE"
    assert body["source_ref"] == "Changes/2026-11-13-project-video-calls.txt"
    assert body["user_stories"][0]["title"] == "Start a project call"
    assert any("2 code files it names" in n for n in body["notes"])

    paths = [s["path"] for s in sent["prompt"]["sources"]]
    assert paths == [
        "Changes/2026-11-13-project-video-calls.txt",
        "frontend/src/app/(app)/chat/page.tsx",
        "backend/app/services/calls.py",
    ]
    assert "app/users.py" not in paths  # unrelated code is not read
    assert sent["prompt"]["source"].startswith("Change note: Project video calls (2026-11-13)")
    assert "TEST IDEAS FOR BA / QA" in sent["prompt"]["source"]
    assert "change note written for business analysts" in sent["rules"]

    # Saved items remember the note; a note never shows up as out of date.
    saved = client.post("/api/ai-generator/save", headers=auth, json=body)
    assert saved.status_code == 200, saved.text
    issue = client.get(f"/api/issues/{saved.json()['issue_ids'][0]}", headers=auth).json()
    assert issue["ai_source"]["source_kind"] == "NOTE"
    suggestions = client.get(
        f"/api/ai-generator/projects/{p['id']}/change-suggestions", headers=auth
    ).json()
    assert suggestions["stale_story_ids"] == []


def test_change_note_works_without_openai(client, auth, monkeypatch):
    p = project(client, auth, monkeypatch)
    draft = client.post(
        "/api/ai-generator/generate",
        headers=auth,
        json={"project_id": p["id"], "change_note": "Changes/2026-11-13-project-video-calls.txt"},
    )
    assert draft.status_code == 200, draft.text
    assert draft.json()["user_stories"]


def test_change_note_cannot_be_combined_with_a_branch(client, auth, monkeypatch):
    p = project(client, auth, monkeypatch)
    response = client.post(
        "/api/ai-generator/generate",
        headers=auth,
        json={
            "project_id": p["id"],
            "change_note": "Changes/2026-11-13-project-video-calls.txt",
            "branch": "feature/x",
        },
    )
    assert response.status_code == 422
