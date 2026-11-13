import httpx
import jwt
import pytest

from app.core.config import settings
from app.services import calls
from tests.conftest import create_user

START = "2026-11-20T10:00:00+05:30"
END = "2026-11-20T10:30:00+05:30"


def me(client, headers):
    return client.get("/api/auth/me", headers=headers).json()


@pytest.fixture
def team(client, auth):
    """Alex (admin) plus three employees: Mia and Raj get invited, Omar does not."""
    people = {"alex": auth}
    for key, first, last in (("mia", "Mia", "Wong"), ("raj", "Raj", "Patel"), ("omar", "Omar", "Diaz")):
        people[key] = create_user(client, auth, first, last, f"{key}@example.com")
    ids = {key: me(client, h)["id"] for key, h in people.items()}
    return people, ids


def schedule(client, headers, attendee_ids, **extra):
    body = {
        "title": "Sprint review",
        "description": "Demo the calendar",
        "starts_at": START,
        "ends_at": END,
        "attendee_ids": attendee_ids,
        **extra,
    }
    return client.post("/api/meetings", headers=headers, json=body)


def listed(client, headers, start="2026-11-01T00:00:00Z", end="2026-12-01T00:00:00Z"):
    response = client.get("/api/meetings", headers=headers, params={"start": start, "end": end})
    assert response.status_code == 200, response.text
    return [m["title"] for m in response.json()]


def test_anyone_can_schedule_and_invite_colleagues(client, auth, team):
    people, ids = team
    created = schedule(client, people["mia"], [ids["raj"], ids["raj"], ids["mia"]])
    assert created.status_code == 201, created.text
    meeting = created.json()
    assert meeting["organizer"]["id"] == ids["mia"]
    # Duplicates and the organizer are dropped from the invite list.
    assert [p["id"] for p in meeting["attendees"]] == [ids["raj"]]
    assert "email" not in meeting["organizer"]
    # Stored in UTC: 10:00 India time is 04:30 UTC.
    assert meeting["starts_at"] in ("2026-11-20T04:30:00Z", "2026-11-20T04:30:00+00:00")

    assert listed(client, people["mia"]) == ["Sprint review"]
    assert listed(client, people["raj"]) == ["Sprint review"]
    assert listed(client, people["omar"]) == []
    # Admins see their own calendar, not everyone's.
    assert listed(client, people["alex"]) == []


def test_range_returns_only_overlapping_meetings(client, auth, team):
    people, ids = team
    schedule(client, people["mia"], [])
    assert listed(client, people["mia"], "2026-11-20T04:00:00Z", "2026-11-20T04:31:00Z") == ["Sprint review"]
    assert listed(client, people["mia"], "2026-11-20T05:00:00Z", "2026-11-21T00:00:00Z") == []
    too_long = client.get(
        "/api/meetings",
        headers=people["mia"],
        params={"start": "2026-01-01T00:00:00Z", "end": "2026-12-01T00:00:00Z"},
    )
    assert too_long.status_code == 422


def test_only_invited_people_open_a_meeting_and_only_organizer_edits(client, auth, team):
    people, ids = team
    meeting = schedule(client, people["mia"], [ids["raj"]]).json()
    url = f"/api/meetings/{meeting['id']}"
    assert client.get(url, headers=people["raj"]).status_code == 200
    assert client.get(url, headers=people["omar"]).status_code == 404
    assert client.get(url, headers=people["alex"]).status_code == 200  # admin

    change = {
        "title": "Sprint review (moved)",
        "starts_at": "2026-11-20T11:00:00+05:30",
        "ends_at": "2026-11-20T12:00:00+05:30",
        "attendee_ids": [ids["raj"], ids["omar"]],
    }
    assert client.put(url, headers=people["raj"], json=change).status_code == 403
    updated = client.put(url, headers=people["mia"], json=change)
    assert updated.status_code == 200, updated.text
    assert {p["id"] for p in updated.json()["attendees"]} == {ids["raj"], ids["omar"]}
    assert listed(client, people["omar"]) == ["Sprint review (moved)"]

    assert client.delete(url, headers=people["raj"]).status_code == 403
    assert client.delete(url, headers=people["mia"]).status_code == 204
    assert listed(client, people["raj"]) == []


@pytest.mark.parametrize(
    "starts_at, ends_at",
    [
        ("2026-11-20T10:30:00+05:30", "2026-11-20T10:00:00+05:30"),  # ends before it starts
        ("2026-11-20T10:00:00+05:30", "2026-11-21T10:00:00+05:30"),  # longer than 12 hours
        ("2026-11-20T10:00:00", "2026-11-20T10:30:00"),  # no time zone
    ],
)
def test_bad_times_are_rejected(client, auth, team, starts_at, ends_at):
    people, _ = team
    response = schedule(client, people["mia"], [], starts_at=starts_at, ends_at=ends_at)
    assert response.status_code == 422


def test_unknown_people_and_blank_titles_are_rejected(client, auth, team):
    people, _ = team
    assert schedule(client, people["mia"], [99999]).status_code == 422
    assert schedule(client, people["mia"], [], title="   ").status_code == 422


def test_project_tag_must_be_a_project_the_organizer_can_open(client, auth, team):
    people, ids = team
    project = client.post(
        "/api/projects", headers=auth, json={"name": "Admin only", "key": "ADM", "description": ""}
    ).json()
    assert schedule(client, people["mia"], [], project_id=project["id"]).status_code == 404
    tagged = schedule(client, auth, [ids["mia"]], project_id=project["id"])
    assert tagged.status_code == 201
    assert tagged.json()["project"] == {"id": project["id"], "key": "ADM", "name": "Admin only"}


def test_people_list_is_open_to_everyone_without_emails(client, auth, team):
    people, ids = team
    response = client.get("/api/meetings/people", headers=people["omar"])
    assert response.status_code == 200
    body = response.json()
    assert {p["id"] for p in body} == set(ids.values())
    assert all("email" not in p for p in body)


def test_meeting_call_room_is_private_to_the_meeting(client, auth, team, monkeypatch):
    people, ids = team
    monkeypatch.setattr(settings, "livekit_api_key", "APIkey")
    monkeypatch.setattr(settings, "livekit_api_secret", "s" * 40)
    monkeypatch.setattr(
        calls.httpx, "post", lambda *a, **k: httpx.Response(404, json={"code": "not_found"})
    )
    meeting = schedule(client, people["mia"], [ids["raj"]]).json()
    url = f"/api/meetings/{meeting['id']}/call"

    assert client.get(url, headers=people["raj"]).json() == {
        "enabled": True,
        "active": False,
        "participants": [],
    }
    joined = client.post(f"{url}/join", headers=people["raj"])
    assert joined.status_code == 200, joined.text
    claims = jwt.decode(joined.json()["token"], "s" * 40, algorithms=["HS256"])
    assert claims["video"]["room"] == f"meeting-{meeting['id']}"
    assert claims["sub"] == f"user-{ids['raj']}"

    assert client.get(url, headers=people["omar"]).status_code == 404
    assert client.post(f"{url}/join", headers=people["omar"]).status_code == 404
