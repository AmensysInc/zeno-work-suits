import httpx
import jwt
import pytest

from app.core.config import settings
from app.services import calls
from tests.conftest import create_user


@pytest.fixture
def livekit(monkeypatch):
    """Calls switched on, with the LiveKit server faked; `state["people"]` is who is in the room."""
    monkeypatch.setattr(settings, "livekit_api_key", "APIkey")
    monkeypatch.setattr(settings, "livekit_api_secret", "s" * 40)
    monkeypatch.setattr(settings, "livekit_url", "wss://calls.example.com")
    state = {"people": [], "requests": []}

    def fake_post(url, json, headers, timeout):
        state["requests"].append((url, json, headers))
        if not state["people"]:
            return httpx.Response(404, json={"code": "not_found", "msg": "room not found"})
        return httpx.Response(200, json={"participants": state["people"]})

    monkeypatch.setattr(calls.httpx, "post", fake_post)
    return state


def _project(client, auth, key="CAL"):
    return client.post(
        "/api/projects", headers=auth, json={"name": "Calls", "key": key, "description": ""}
    ).json()


def test_calls_are_off_without_keys(client, auth, monkeypatch):
    monkeypatch.setattr(settings, "livekit_api_key", "")
    monkeypatch.setattr(settings, "livekit_api_secret", "")
    project = _project(client, auth)
    status = client.get(f"/api/projects/{project['id']}/call", headers=auth)
    assert status.status_code == 200
    assert status.json() == {"enabled": False, "active": False, "participants": []}
    assert client.post(f"/api/projects/{project['id']}/call/join", headers=auth).status_code == 503


def test_first_joiner_gets_room_token_and_posts_to_chat(client, auth, livekit):
    project = _project(client, auth)
    me = client.get("/api/auth/me", headers=auth).json()

    assert client.get(f"/api/projects/{project['id']}/call", headers=auth).json()["active"] is False

    joined = client.post(f"/api/projects/{project['id']}/call/join", headers=auth)
    assert joined.status_code == 200, joined.text
    body = joined.json()
    assert body["url"] == "wss://calls.example.com"
    assert body["room"] == f"project-{project['id']}"
    claims = jwt.decode(body["token"], "s" * 40, algorithms=["HS256"])
    assert claims["iss"] == "APIkey"
    assert claims["sub"] == f"user-{me['id']}"
    assert claims["name"] == f"{me['first_name']} {me['last_name']}"
    assert claims["video"]["room"] == f"project-{project['id']}"
    assert claims["video"]["roomJoin"] is True
    assert "roomAdmin" not in claims["video"]

    chat = client.get(f"/api/projects/{project['id']}/chat", headers=auth).json()
    assert [m["body"] for m in chat] == [calls.CALL_STARTED]

    # Someone is now in the room: status shows them, and the next joiner posts nothing.
    livekit["people"] = [{"identity": f"user-{me['id']}", "name": "Alex Rivera", "metadata": f'{{"user_id": {me["id"]}}}'}]
    status = client.get(f"/api/projects/{project['id']}/call", headers=auth).json()
    assert status["active"] is True
    assert status["participants"] == [{"identity": f"user-{me['id']}", "name": "Alex Rivera", "user_id": me["id"]}]
    assert client.post(f"/api/projects/{project['id']}/call/join", headers=auth).status_code == 200
    assert len(client.get(f"/api/projects/{project['id']}/chat", headers=auth).json()) == 1

    # The backend asks LiveKit with an admin token scoped to this one room.
    url, payload, headers = livekit["requests"][-1]
    assert url.endswith("/twirp/livekit.RoomService/ListParticipants")
    assert payload == {"room": f"project-{project['id']}"}
    admin = jwt.decode(headers["Authorization"].split()[1], "s" * 40, algorithms=["HS256"])
    assert admin["video"] == {"roomAdmin": True, "room": f"project-{project['id']}"}


def test_outsiders_cannot_see_or_join_a_projects_call(client, auth, livekit):
    project = _project(client, auth)
    outsider = create_user(client, auth, "Omar", "Diaz", "omar@example.com")
    assert client.get(f"/api/projects/{project['id']}/call", headers=outsider).status_code == 404
    assert client.post(f"/api/projects/{project['id']}/call/join", headers=outsider).status_code == 404


def test_unreachable_call_server_is_a_clear_error(client, auth, livekit, monkeypatch):
    def down(*args, **kwargs):
        raise httpx.ConnectError("refused")

    monkeypatch.setattr(calls.httpx, "post", down)
    project = _project(client, auth)
    response = client.get(f"/api/projects/{project['id']}/call", headers=auth)
    assert response.status_code == 503
    assert response.json()["detail"] == "The call server is not reachable"
