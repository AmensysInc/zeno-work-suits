from datetime import date, datetime, timedelta, timezone

import pytest

from app.models import CallTranscript
from app.services import meetings
from tests.conftest import create_user


def me(client, headers):
    return client.get("/api/auth/me", headers=headers).json()


@pytest.fixture
def team(client, auth):
    people = {"alex": auth}
    for key, first in (("mia", "Mia"), ("omar", "Omar")):
        people[key] = create_user(client, auth, first, "Lee", f"{key}@example.com")
    ids = {key: me(client, h)["id"] for key, h in people.items()}
    return people, ids


def body(ids, **extra):
    return {
        "title": "Standup",
        "description": "",
        "starts_at": "2026-12-01T10:00:00+05:30",
        "ends_at": "2026-12-01T10:15:00+05:30",
        "attendee_ids": [ids["mia"]],
        **extra,
    }


def listed(client, headers, start="2026-11-25T00:00:00Z", end="2027-01-20T00:00:00Z"):
    response = client.get("/api/meetings", headers=headers, params={"start": start, "end": end})
    assert response.status_code == 200, response.text
    return response.json()


def test_occurrence_rules():
    start = datetime(2026, 12, 1, 4, 30, tzinfo=timezone.utc)  # a Tuesday
    end = start + timedelta(minutes=30)
    weekly = meetings.occurrences(start, end, "WEEKLY", date(2026, 12, 31))
    assert [s.day for s, _ in weekly] == [1, 8, 15, 22, 29]
    assert all(e - s == timedelta(minutes=30) for s, e in weekly)
    weekdays = meetings.occurrences(start, end, "WEEKDAYS", date(2026, 12, 8))
    assert [s.day for s, _ in weekdays] == [1, 2, 3, 4, 7, 8]  # no Sat 5 / Sun 6
    assert len(meetings.occurrences(start, end, "BIWEEKLY", date(2026, 12, 31))) == 3
    jan31 = datetime(2027, 1, 31, 9, tzinfo=timezone.utc)
    monthly = meetings.occurrences(jan31, jan31 + timedelta(hours=1), "MONTHLY", date(2027, 4, 30))
    assert [(s.month, s.day) for s, _ in monthly] == [(1, 31), (2, 28), (3, 31), (4, 30)]
    assert len(meetings.occurrences(start, end, "DAILY", date(2027, 12, 1))) == meetings.MAX_OCCURRENCES


def test_daylight_saving_keeps_local_time():
    # 9:00 in New York: 14:00 UTC in winter, 13:00 UTC after clocks go forward.
    start = datetime(2027, 3, 1, 14, tzinfo=timezone.utc)
    weekly = meetings.occurrences(
        start, start + timedelta(hours=1), "WEEKLY", date(2027, 3, 22), "America/New_York"
    )
    assert [s.hour for s, _ in weekly] == [14, 14, 13, 13]


def test_weekly_series_is_created_and_shown(client, team):
    people, ids = team
    created = client.post(
        "/api/meetings",
        headers=people["alex"],
        json=body(ids, repeat="WEEKLY", repeat_until="2026-12-29", time_zone="Asia/Kolkata"),
    )
    assert created.status_code == 201, created.text
    first = created.json()
    assert first["repeat"] == "WEEKLY" and first["series_id"]
    mine = listed(client, people["mia"])
    assert [m["starts_at"][:10] for m in mine] == ["2026-12-01", "2026-12-08", "2026-12-15", "2026-12-22", "2026-12-29"]
    assert {m["series_id"] for m in mine} == {first["series_id"]}
    # One invite for the whole series, not five.
    invites = client.get("/api/notifications", headers=people["mia"]).json()["items"]
    assert len(invites) == 1
    assert invites[0]["body"] == "Repeats every week until Dec 29, 2026"


@pytest.mark.parametrize(
    "extra",
    [
        {"repeat": "WEEKLY"},
        {"repeat": "WEEKLY", "repeat_until": "2026-11-30"},
        {"repeat": "DAILY", "repeat_until": "2028-01-01"},
        {"repeat": "HOURLY", "repeat_until": "2026-12-10"},
    ],
)
def test_bad_repeats_are_rejected(client, team, extra):
    people, ids = team
    response = client.post("/api/meetings", headers=people["alex"], json=body(ids, **extra))
    assert response.status_code == 422


def _series(client, people, ids):
    client.post(
        "/api/meetings",
        headers=people["alex"],
        json=body(ids, repeat="WEEKLY", repeat_until="2026-12-29"),
    )
    return listed(client, people["alex"])


def test_edit_one_following_or_all(client, team):
    people, ids = team
    series = _series(client, people, ids)
    third = series[2]

    # Just this one: only the third meeting is renamed.
    one = client.put(
        f"/api/meetings/{third['id']}", headers=people["alex"],
        json=body(ids, title="Moved", starts_at=third["starts_at"], ends_at=third["ends_at"]),
    )
    assert one.status_code == 200
    assert [m["title"] for m in listed(client, people["alex"])] == ["Standup", "Standup", "Moved", "Standup", "Standup"]

    # This and following: an hour later from the third on, everything else stays.
    later = {
        "starts_at": (datetime.fromisoformat(third["starts_at"]) + timedelta(hours=1)).isoformat(),
        "ends_at": (datetime.fromisoformat(third["ends_at"]) + timedelta(hours=1, minutes=15)).isoformat(),
    }
    client.put(
        f"/api/meetings/{third['id']}", headers=people["alex"], params={"scope": "following"},
        json=body(ids, title="Late standup", **later),
    )
    after = listed(client, people["alex"])
    assert [m["title"] for m in after] == ["Standup", "Standup", "Late standup", "Late standup", "Late standup"]
    assert after[1]["starts_at"] == series[1]["starts_at"]
    assert after[4]["starts_at"][11:16] == "05:30"  # 04:30 UTC + 1 h
    assert all(
        datetime.fromisoformat(m["ends_at"]) - datetime.fromisoformat(m["starts_at"]) == timedelta(minutes=30)
        for m in after[2:]
    )

    # Whole series: Omar is added to every date.
    client.put(
        f"/api/meetings/{after[0]['id']}", headers=people["alex"], params={"scope": "all"},
        json=body(ids, starts_at=after[0]["starts_at"], ends_at=after[0]["ends_at"], attendee_ids=[ids["mia"], ids["omar"]]),
    )
    assert len(listed(client, people["omar"])) == 5


def test_cancel_following_and_all(client, team):
    people, ids = team
    series = _series(client, people, ids)
    gone = client.delete(f"/api/meetings/{series[3]['id']}", headers=people["alex"], params={"scope": "following"})
    assert gone.status_code == 204
    assert len(listed(client, people["mia"])) == 3
    client.delete(f"/api/meetings/{series[0]['id']}", headers=people["alex"], params={"scope": "all"})
    assert listed(client, people["mia"]) == []
    bad = client.delete(f"/api/meetings/{series[0]['id']}", headers=people["alex"], params={"scope": "nope"})
    assert bad.status_code == 422


def test_meeting_chat_is_private_to_the_meeting(client, team):
    people, ids = team
    meeting = client.post("/api/meetings", headers=people["alex"], json=body(ids)).json()
    path = f"/api/meetings/{meeting['id']}/messages"

    sent = client.post(path, headers=people["mia"], json={"body": "  Running 5 min late "})
    assert sent.status_code == 201, sent.text
    assert sent.json()["body"] == "Running 5 min late"
    assert client.post(path, headers=people["mia"], json={"body": "   "}).status_code == 422
    assert client.get(path, headers=people["omar"]).status_code == 404
    assert client.post(path, headers=people["omar"], json={"body": "hi"}).status_code == 404
    assert [m["body"] for m in client.get(path, headers=people["alex"]).json()] == ["Running 5 min late"]

    note = client.get("/api/notifications", headers=people["alex"]).json()["items"][0]
    assert note["kind"] == "chat"
    assert note["link"] == f"/calendar?meeting={meeting['id']}&tab=chat"

    # The organizer may remove any message; others only their own.
    message_id = sent.json()["id"]
    assert client.delete(f"/api/meetings/messages/{message_id}", headers=people["alex"]).status_code == 204


def test_recording_a_meeting_call(client, team):
    people, ids = team
    meeting = client.post("/api/meetings", headers=people["alex"], json=body(ids)).json()

    started = client.post("/api/calls/transcripts", headers=people["mia"], json={"meeting_id": meeting["id"]})
    assert started.status_code == 201, started.text
    rec = started.json()
    assert rec["status"] == "RECORDING"
    # Only one recording per call; the same person pressing again resumes theirs.
    clash = client.post("/api/calls/transcripts", headers=people["alex"], json={"meeting_id": meeting["id"]})
    assert clash.status_code == 409
    assert "Mia Lee is already recording" in clash.json()["detail"]
    again = client.post("/api/calls/transcripts", headers=people["mia"], json={"meeting_id": meeting["id"]})
    assert again.json()["id"] == rec["id"]
    # Outsiders cannot record or read.
    assert client.post("/api/calls/transcripts", headers=people["omar"], json={"meeting_id": meeting["id"]}).status_code == 404
    assert client.get(f"/api/meetings/{meeting['id']}/transcripts", headers=people["omar"]).status_code == 404

    path = f"/api/calls/transcripts/{rec['id']}"
    client.put(path, headers=people["mia"], json={"text": "Speaker 1: hello", "languages": ["en"]})
    assert client.put(path, headers=people["alex"], json={"text": "x"}).status_code == 404
    done = client.put(path, headers=people["mia"], json={"text": "Speaker 1: hello\nSpeaker 2: namaste", "languages": ["en", "hi", "<bad>"], "finished": True})
    assert done.status_code == 200
    assert done.json()["status"] == "DONE"
    assert done.json()["languages"] == ["en", "hi"]
    assert client.put(path, headers=people["mia"], json={"text": "late"}).status_code == 409

    listed_ = client.get(f"/api/meetings/{meeting['id']}/transcripts", headers=people["alex"]).json()
    assert [t["text"] for t in listed_] == ["Speaker 1: hello\nSpeaker 2: namaste"]
    note = client.get("/api/notifications", headers=people["alex"]).json()["items"][0]
    assert note["kind"] == "transcript"
    assert note["title"] == "Transcript of “Standup” is ready"

    # Once ended, someone else may record a new part of the call.
    assert client.post("/api/calls/transcripts", headers=people["alex"], json={"meeting_id": meeting["id"]}).status_code == 201


def test_project_call_recording_and_interrupted(client, team):
    people, ids = team
    project = client.post("/api/projects", headers=people["alex"], json={"key": "REC", "name": "Rec"}).json()
    assert client.post("/api/calls/transcripts", headers=people["mia"], json={"project_id": project["id"]}).status_code == 404
    rec = client.post("/api/calls/transcripts", headers=people["alex"], json={"project_id": project["id"]}).json()
    assert client.post("/api/calls/transcripts", headers=people["alex"], json={}).status_code == 422

    # The recorder's tab closed: after a couple of minutes it shows as interrupted
    # and no longer blocks a new recording.
    with client.sessions() as db:
        row = db.get(CallTranscript, rec["id"])
        row.updated_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        db.commit()
    shown = client.get(f"/api/projects/{project['id']}/transcripts", headers=people["alex"]).json()
    assert shown[0]["status"] == "INTERRUPTED"
    with client.sessions() as db:
        assert db.get(CallTranscript, rec["id"]).status == "RECORDING"  # label only
    assert client.delete(f"/api/calls/transcripts/{rec['id']}", headers=people["alex"]).status_code == 204
