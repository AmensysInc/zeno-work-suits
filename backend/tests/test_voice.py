import httpx
from app.api import voice
from app.core.config import settings
from tests.conftest import create_user


def fake_soniox(calls, status=201):
    def request(method, url, **kwargs):
        calls.append((method, url.removeprefix(voice.SONIOX_URL), kwargs))
        return httpx.Response(
            status,
            json={"api_key": "snx_temp_abc", "expires_at": "2026-10-30T12:05:00Z"},
        )

    return request


def test_session_mints_a_temporary_key(client, auth, monkeypatch):
    monkeypatch.setattr(settings, "soniox_api_key", "soniox-secret")
    calls = []
    monkeypatch.setattr(voice.httpx, "request", fake_soniox(calls))
    body = client.post("/api/voice/session", headers=auth).json()
    # The browser gets only the short-lived key, never the account key.
    assert body["api_key"] == "snx_temp_abc"
    assert body["websocket_url"].startswith("wss://stt-rt.soniox.com/")
    assert body["model"] == settings.soniox_model
    assert "soniox-secret" not in str(body)
    [(method, path, kwargs)] = calls
    assert (method, path) == ("POST", "/auth/temporary-api-key")
    assert kwargs["headers"]["Authorization"] == "Bearer soniox-secret"
    assert kwargs["json"]["usage_type"] == "transcribe_websocket"
    assert kwargs["json"]["single_use"] is True


def test_session_reads_the_old_key_name(client, auth, monkeypatch):
    monkeypatch.setattr(settings, "soniox_api_key", "")
    monkeypatch.setattr(settings, "sonix_api_key", "legacy-name")
    calls = []
    monkeypatch.setattr(voice.httpx, "request", fake_soniox(calls))
    assert client.post("/api/voice/session", headers=auth).status_code == 200
    assert calls[0][2]["headers"]["Authorization"] == "Bearer legacy-name"


def test_session_errors_name_soniox(client, auth, monkeypatch):
    monkeypatch.setattr(settings, "soniox_api_key", "")
    monkeypatch.setattr(settings, "sonix_api_key", "")
    missing = client.post("/api/voice/session", headers=auth)
    assert missing.status_code == 503
    assert "SONIOX_API_KEY" in missing.json()["detail"]

    monkeypatch.setattr(settings, "soniox_api_key", "bad")
    monkeypatch.setattr(voice.httpx, "request", fake_soniox([], status=401))
    rejected = client.post("/api/voice/session", headers=auth)
    assert rejected.status_code == 502
    assert "Soniox rejected the API key" in rejected.json()["detail"]


def test_transcripts_are_saved_searched_edited_and_private(client, auth):
    other = create_user(client, auth, "Vic", "Voice", "vic@example.com")
    project = client.post(
        "/api/projects", headers=auth, json={"key": "VOX", "name": "Vox"}
    ).json()
    created = client.post(
        "/api/voice/transcripts",
        headers=auth,
        json={
            "title": "  Standup  ",
            "text": "Hello team. ఈ రోజు demo ఉంది.",
            "languages": ["en", "te", "en", "BAD!"],
            "duration_seconds": 95,
            "project_id": project["id"],
        },
    )
    assert created.status_code == 201, created.text
    item = created.json()
    assert (item["title"], item["languages"], item["duration_seconds"]) == (
        "Standup",
        ["en", "te"],
        95,
    )
    assert item["project"]["key"] == "VOX"
    untitled = client.post(
        "/api/voice/transcripts", headers=auth, json={"text": "Quick note"}
    ).json()
    assert untitled["title"] == "Untitled transcript"

    listed = client.get("/api/voice/transcripts", headers=auth).json()
    assert [t["id"] for t in listed] == [untitled["id"], item["id"]]
    found = client.get("/api/voice/transcripts?q=demo", headers=auth).json()
    assert [t["id"] for t in found] == [item["id"]]

    url = f"/api/voice/transcripts/{item['id']}"
    edited = client.put(
        url, headers=auth, json={"title": "Standup notes", "text": "Edited"}
    ).json()
    assert (edited["title"], edited["text"]) == ("Standup notes", "Edited")

    # Someone else's transcripts stay invisible to them.
    assert client.get("/api/voice/transcripts", headers=other).json() == []
    assert client.get(url, headers=other).status_code == 404
    assert client.delete(url, headers=other).status_code == 404
    assert client.delete(url, headers=auth).status_code == 204
    assert client.get(url, headers=auth).status_code == 404


def test_transcript_project_must_be_visible(client, auth):
    other = create_user(client, auth, "Ola", "Out", "ola@example.com")
    project = client.post(
        "/api/projects", headers=auth, json={"key": "SEC", "name": "Secret"}
    ).json()
    blocked = client.post(
        "/api/voice/transcripts",
        headers=other,
        json={"text": "x", "project_id": project["id"]},
    )
    assert blocked.status_code == 404
