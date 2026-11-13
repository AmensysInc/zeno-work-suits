"""Project video calls on a self-hosted LiveKit server.

Each project has one call room, "project-<id>". Only people who can open the
project get a join token, so access follows the same rules as the project chat.
"""

import json
import time

import httpx
import jwt
from fastapi import HTTPException

from app.core.config import settings
from app.models import ChatMessage
from app.services.access import project_access

TOKEN_TTL_SECONDS = 2 * 60 * 60
CALL_STARTED = "📞 started a video call"


def enabled() -> bool:
    return bool(settings.livekit_api_key and settings.livekit_api_secret)


def room_name(project_id: int) -> str:
    return f"project-{project_id}"


def _full_name(user) -> str:
    return f"{user.first_name} {user.last_name}".strip()


def _token(identity: str, grants: dict, name: str = "", metadata: str = "") -> str:
    now = int(time.time())
    claims = {
        "iss": settings.livekit_api_key,
        "sub": identity,
        "jti": f"{identity}-{now}",
        "nbf": now - 10,
        "exp": now + TOKEN_TTL_SECONDS,
        "video": grants,
    }
    if name:
        claims["name"] = name
    if metadata:
        claims["metadata"] = metadata
    return jwt.encode(claims, settings.livekit_api_secret, algorithm="HS256")


def participants(project_id: int) -> list[dict]:
    """Who is in the project's call right now; empty when no call is running."""
    room = room_name(project_id)
    token = _token("zeno-backend", {"roomAdmin": True, "room": room})
    try:
        response = httpx.post(
            f"{settings.livekit_api_url.rstrip('/')}/twirp/livekit.RoomService/ListParticipants",
            json={"room": room},
            headers={"Authorization": f"Bearer {token}"},
            timeout=5,
        )
    except httpx.HTTPError:
        raise HTTPException(503, "The call server is not reachable")
    if response.status_code == 404:  # no participants yet, so the room does not exist
        return []
    if response.status_code >= 400:
        raise HTTPException(503, "The call server is not reachable")
    people = []
    for p in response.json().get("participants", []):
        try:
            meta = json.loads(p.get("metadata") or "{}")
        except ValueError:
            meta = {}
        people.append(
            {
                "identity": p.get("identity", ""),
                "name": p.get("name") or p.get("identity", ""),
                "user_id": meta.get("user_id"),
            }
        )
    return people


def status(db, actor, project_id: int) -> dict:
    project_access(db, project_id, actor)
    if not enabled():
        return {"enabled": False, "active": False, "participants": []}
    people = participants(project_id)
    return {"enabled": True, "active": bool(people), "participants": people}


def join(db, actor, project_id: int) -> dict:
    project_access(db, project_id, actor)
    if not enabled():
        raise HTTPException(503, "Video calls are not set up on this server")
    room = room_name(project_id)
    if not participants(project_id):
        # The first person in posts to the project chat, so the team sees the call.
        db.add(ChatMessage(project_id=project_id, user_id=actor.id, body=CALL_STARTED))
        db.commit()
    token = _token(
        f"user-{actor.id}",
        {
            "room": room,
            "roomJoin": True,
            "canPublish": True,
            "canSubscribe": True,
            "canPublishData": True,
        },
        name=_full_name(actor),
        metadata=json.dumps({"user_id": actor.id}),
    )
    return {"url": settings.livekit_url, "token": token, "room": room}
