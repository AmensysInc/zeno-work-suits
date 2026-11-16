import pytest

from app.services import calls
from tests.conftest import create_user


def me(client, headers):
    return client.get("/api/auth/me", headers=headers).json()


def inbox(client, headers):
    response = client.get("/api/notifications", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture
def team(client, auth):
    """Alex (admin) owns a project; Mia and Raj are on it, Omar is not."""
    people = {"alex": auth}
    for key, first, last in (("mia", "Mia", "Wong"), ("raj", "Raj", "Patel"), ("omar", "Omar", "Diaz")):
        people[key] = create_user(client, auth, first, last, f"{key}@example.com")
    ids = {key: me(client, h)["id"] for key, h in people.items()}
    project = client.post(
        "/api/projects", headers=auth, json={"key": "NOTE", "name": "Notify"}
    ).json()
    client.post(
        f"/api/projects/{project['id']}/members",
        headers=auth,
        json={"user_ids": [ids["mia"], ids["raj"]], "role": "DEVELOPER"},
    )
    return people, ids, project


def new_issue(client, headers, project, **extra):
    response = client.post(
        "/api/issues",
        headers=headers,
        json={
            "project_id": project["id"],
            "issue_type": "TASK",
            "summary": "Fix login",
            "description": "",
            **extra,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_assigning_a_new_issue_notifies_the_assignee_only(client, team):
    people, ids, project = team
    issue = new_issue(client, people["alex"], project, assignee_ids=[ids["mia"], ids["alex"]])

    mia = inbox(client, people["mia"])
    assert mia["unread"] == 1
    item = mia["items"][0]
    assert item["kind"] == "issue_assigned"
    assert item["title"] == f"Alex Rivera assigned you {issue['issue_key']}"
    assert item["body"] == "Fix login"
    assert item["link"] == f"/issues/{issue['id']}"
    assert item["actor"]["first_name"] == "Alex"
    # Alex did it, so Alex hears nothing; Raj and Omar are not involved.
    assert inbox(client, people["alex"])["unread"] == 0
    assert inbox(client, people["raj"])["unread"] == 0
    assert inbox(client, people["omar"])["unread"] == 0


def test_status_change_tells_reporter_and_assignees(client, team):
    people, ids, project = team
    issue = new_issue(client, people["alex"], project, assignee_ids=[ids["mia"], ids["raj"]])
    client.post("/api/notifications/read", headers=people["raj"], json={"all": True})

    moved = client.patch(
        f"/api/issues/{issue['id']}/status", headers=people["mia"], json={"status": "IN_PROGRESS"}
    )
    assert moved.status_code == 200, moved.text

    for who in ("alex", "raj"):
        latest = inbox(client, people[who])["items"][0]
        assert latest["kind"] == "issue_status"
        assert "Mia Wong updated" in latest["title"]
        assert "Status: Backlog → In Progress" in latest["body"]
    mia_kinds = [n["kind"] for n in inbox(client, people["mia"])["items"]]
    assert mia_kinds == ["issue_assigned"]  # nothing for her own change


def test_reassigning_and_reordering(client, team):
    people, ids, project = team
    issue = new_issue(client, people["alex"], project, assignee_ids=[ids["mia"]])
    client.put(f"/api/issues/{issue['id']}", headers=people["alex"], json={"assignee_ids": [ids["raj"]]})

    assert inbox(client, people["mia"])["items"][0]["kind"] == "issue_unassigned"
    raj = inbox(client, people["raj"])["items"]
    assert [n["kind"] for n in raj] == ["issue_assigned"]

    # Dragging a card to a new spot is not worth a notification.
    client.put(f"/api/issues/{issue['id']}", headers=people["alex"], json={"order_index": 5})
    assert len(inbox(client, people["raj"])["items"]) == 1


def test_comment_notifies_people_on_the_issue(client, team):
    people, ids, project = team
    issue = new_issue(client, people["alex"], project, assignee_ids=[ids["mia"]])
    client.post(
        f"/api/issues/{issue['id']}/comments", headers=people["raj"], json={"body": "Looks good"}
    )
    for who in ("alex", "mia"):
        latest = inbox(client, people[who])["items"][0]
        assert latest["kind"] == "comment"
        assert latest["body"] == "Looks good"
    assert inbox(client, people["raj"])["unread"] == 0


def test_chat_message_notifies_the_project_team(client, team):
    people, ids, project = team
    sent = client.post(
        f"/api/projects/{project['id']}/chat", headers=people["mia"], json={"body": "Standup in 5"}
    )
    assert sent.status_code == 201
    for who in ("alex", "raj"):
        latest = inbox(client, people[who])["items"][0]
        assert latest["kind"] == "chat"
        assert latest["title"] == "Mia Wong in Notify"
        assert latest["link"] == f"/chat?project={project['id']}"
    assert inbox(client, people["mia"])["unread"] == 0
    assert inbox(client, people["omar"])["unread"] == 0


def test_starting_a_call_notifies_the_team(client, team, monkeypatch):
    people, ids, project = team
    monkeypatch.setattr(calls, "enabled", lambda: True)
    monkeypatch.setattr(calls, "_participants", lambda room: [])
    joined = client.post(f"/api/projects/{project['id']}/call/join", headers=people["raj"])
    assert joined.status_code == 200, joined.text
    latest = inbox(client, people["mia"])["items"][0]
    assert latest["kind"] == "call"
    assert latest["title"] == "Raj Patel started a video call"


def test_meeting_invite_update_and_cancel(client, team):
    people, ids, _ = team
    body = {
        "title": "Sprint review",
        "description": "Demo",
        "starts_at": "2026-11-20T10:00:00Z",
        "ends_at": "2026-11-20T10:30:00Z",
        "attendee_ids": [ids["mia"]],
    }
    meeting = client.post("/api/meetings", headers=people["alex"], json=body).json()
    invite = inbox(client, people["mia"])["items"][0]
    assert invite["kind"] == "meeting_invite"
    assert invite["link"] == f"/calendar?meeting={meeting['id']}"

    client.put(
        f"/api/meetings/{meeting['id']}",
        headers=people["alex"],
        json={**body, "attendee_ids": [ids["mia"], ids["omar"]]},
    )
    assert inbox(client, people["mia"])["items"][0]["kind"] == "meeting_updated"
    assert inbox(client, people["omar"])["items"][0]["kind"] == "meeting_invite"

    client.delete(f"/api/meetings/{meeting['id']}", headers=people["alex"])
    for who in ("mia", "omar"):
        assert inbox(client, people[who])["items"][0]["kind"] == "meeting_cancelled"


def test_mark_read_only_touches_your_own(client, team):
    people, ids, project = team
    new_issue(client, people["alex"], project, assignee_ids=[ids["mia"]])
    new_issue(client, people["alex"], project, assignee_ids=[ids["mia"], ids["raj"]])
    mia_items = inbox(client, people["mia"])["items"]
    raj_items = inbox(client, people["raj"])["items"]

    # Raj cannot mark Mia's notification read.
    client.post("/api/notifications/read", headers=people["raj"], json={"ids": [mia_items[0]["id"]]})
    assert inbox(client, people["mia"])["unread"] == 2

    client.post("/api/notifications/read", headers=people["mia"], json={"ids": [mia_items[0]["id"]]})
    mia = inbox(client, people["mia"])
    assert mia["unread"] == 1
    assert mia["items"][0]["read_at"] is not None
    assert mia["items"][1]["read_at"] is None

    client.post("/api/notifications/read", headers=people["mia"], json={"all": True})
    assert inbox(client, people["mia"])["unread"] == 0
    assert inbox(client, people["raj"])["unread"] == len(raj_items) == 1

    bad = client.post("/api/notifications/read", headers=people["mia"], json={})
    assert bad.status_code == 422


def test_notifications_need_sign_in(client):
    assert client.get("/api/notifications").status_code == 401
