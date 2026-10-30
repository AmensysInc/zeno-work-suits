import re
import httpx
from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import or_, select
from app.api.deps import DB, Actor
from app.core.config import settings
from app.models import VoiceTranscript
from app.schemas.voice import (
    LANGUAGE,
    TranscriptIn,
    TranscriptOut,
    TranscriptUpdate,
    VoiceSessionOut,
)
from app.services.access import project_access

router = APIRouter(prefix="/voice", tags=["Voice agent"])
SONIOX_URL = "https://api.soniox.com/v1"
SONIOX_WEBSOCKET = "wss://stt-rt.soniox.com/transcribe-websocket"
# A temporary key only has to open the stream; the stream itself may run for hours.
KEY_TTL_SECONDS = 300
MAX_SESSION_SECONDS = 4 * 3600


def _api_key() -> str:
    # SONIX_API_KEY is the old name of this setting; keep reading it.
    return settings.soniox_api_key or settings.sonix_api_key


def soniox(method: str, path: str, **kwargs) -> httpx.Response:
    """Calls Soniox with the server-side key; the key never reaches the browser."""
    key = _api_key()
    if not key:
        raise HTTPException(503, "Voice agent is not configured: set SONIOX_API_KEY")
    try:
        response = httpx.request(
            method,
            f"{SONIOX_URL}{path}",
            headers={"Authorization": f"Bearer {key}"},
            timeout=30,
            **kwargs,
        )
    except httpx.HTTPError:
        raise HTTPException(502, "Could not reach Soniox. Please try again.")
    if response.status_code == 401:
        raise HTTPException(502, "Soniox rejected the API key (bad credentials)")
    if response.status_code == 402:
        raise HTTPException(
            502, "Soniox balance is exhausted; add funds in the Soniox console"
        )
    if response.status_code >= 400:
        try:
            body = response.json()
            detail = body.get("message") or body.get("error_message") or ""
        except ValueError:
            detail = ""
        raise HTTPException(
            502, f"Soniox error {response.status_code}{f': {detail}' if detail else ''}"
        )
    return response


@router.post("/session", response_model=VoiceSessionOut)
def session(actor: Actor):
    """A short-lived Soniox key the browser uses to stream audio for live transcription."""
    created = soniox(
        "POST",
        "/auth/temporary-api-key",
        json={
            "usage_type": "transcribe_websocket",
            "expires_in_seconds": KEY_TTL_SECONDS,
            "max_session_duration_seconds": MAX_SESSION_SECONDS,
            "single_use": True,
            "client_reference_id": f"zeno-voice-{actor.id}",
        },
    ).json()
    return {
        "api_key": created["api_key"],
        "expires_at": created.get("expires_at", ""),
        "websocket_url": SONIOX_WEBSOCKET,
        "model": settings.soniox_model,
    }


def _owned(db, id: int, actor) -> VoiceTranscript:
    transcript = db.get(VoiceTranscript, id)
    if not transcript or transcript.user_id != actor.id:
        raise HTTPException(404, "Transcript not found")
    return transcript


@router.get("/transcripts", response_model=list[TranscriptOut])
def transcripts(db: DB, actor: Actor, q: str = Query(default="", max_length=200)):
    query = select(VoiceTranscript).where(VoiceTranscript.user_id == actor.id)
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.where(
            or_(VoiceTranscript.title.ilike(like), VoiceTranscript.text.ilike(like))
        )
    return db.scalars(
        query.order_by(VoiceTranscript.created_at.desc(), VoiceTranscript.id.desc())
    ).all()


@router.post("/transcripts", response_model=TranscriptOut, status_code=201)
def create_transcript(data: TranscriptIn, db: DB, actor: Actor):
    if data.project_id is not None:
        project_access(db, data.project_id, actor)
    transcript = VoiceTranscript(
        user_id=actor.id,
        project_id=data.project_id,
        title=data.title.strip() or "Untitled transcript",
        text=data.text,
        languages=[
            code for code in dict.fromkeys(data.languages) if re.match(LANGUAGE, code)
        ],
        duration_seconds=data.duration_seconds,
    )
    db.add(transcript)
    db.commit()
    db.refresh(transcript)
    return transcript


@router.get("/transcripts/{id}", response_model=TranscriptOut)
def show_transcript(id: int, db: DB, actor: Actor):
    return _owned(db, id, actor)


@router.put("/transcripts/{id}", response_model=TranscriptOut)
def update_transcript(id: int, data: TranscriptUpdate, db: DB, actor: Actor):
    transcript = _owned(db, id, actor)
    transcript.title = data.title.strip()
    transcript.text = data.text
    db.commit()
    db.refresh(transcript)
    return transcript


@router.delete("/transcripts/{id}", status_code=204)
def delete_transcript(id: int, db: DB, actor: Actor):
    db.delete(_owned(db, id, actor))
    db.commit()
    return Response(status_code=204)
