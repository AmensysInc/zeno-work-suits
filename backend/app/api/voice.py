import hashlib
import hmac
from urllib.parse import quote
import httpx
from fastapi import APIRouter, HTTPException, Query, UploadFile
from app.api.deps import Actor
from app.core.config import settings

router = APIRouter(prefix="/voice", tags=["Voice agent"])
SONIX_URL = "https://api.sonix.ai/v1"
MAX_UPLOAD_BYTES = 25 * 1024 * 1024


def sonix(method: str, path: str, **kwargs) -> httpx.Response:
    """Calls Sonix with the server-side key; the key never reaches the browser."""
    if not settings.sonix_api_key:
        raise HTTPException(503, "Voice agent is not configured: set SONIX_API_KEY")
    try:
        response = httpx.request(
            method,
            f"{SONIX_URL}{path}",
            headers={"Authorization": f"Bearer {settings.sonix_api_key}"},
            timeout=60,
            **kwargs,
        )
    except httpx.HTTPError:
        raise HTTPException(502, "Could not reach Sonix. Please try again.")
    if response.status_code == 401:
        raise HTTPException(502, "Sonix rejected the API key (bad credentials)")
    if response.status_code == 404:
        raise HTTPException(404, "Recording not found")
    if response.status_code >= 400:
        raise HTTPException(502, f"Sonix error {response.status_code}")
    return response


def _signature(actor, media_id: str) -> str:
    message = f"voice:{actor.id}:{media_id}".encode()
    return hmac.new(settings.jwt_secret.encode(), message, hashlib.sha256).hexdigest()[:32]


def _owned_media(actor, transcription_id: str) -> str:
    """The Sonix media id, only for the person who uploaded the recording."""
    media_id, _, signature = transcription_id.rpartition(".")
    if not media_id or not hmac.compare_digest(signature, _signature(actor, media_id)):
        raise HTTPException(404, "Recording not found")
    return media_id


@router.post("/transcriptions", status_code=201)
async def create(
    file: UploadFile,
    actor: Actor,
    language: str = Query(default="en", pattern=r"^[a-z]{2}(-[A-Za-z]{2})?$"),
):
    # Read one byte past the limit rather than the whole upload.
    audio = await file.read(MAX_UPLOAD_BYTES + 1)
    if not audio:
        raise HTTPException(422, "The recording is empty")
    if len(audio) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Recordings are limited to 25 MB")
    media = sonix(
        "POST",
        "/media",
        data={"language": language, "name": f"Voice note by {actor.email}"},
        files={"file": (file.filename or "voice.webm", audio, file.content_type)},
    ).json()
    # Sonix ids are shared across the account; the signed id ties this one to its uploader.
    media_id = str(media["id"])
    return {
        "id": f"{media_id}.{_signature(actor, media_id)}",
        "status": media.get("status", "preparing"),
    }


@router.get("/transcriptions/{transcription_id}")
def show(transcription_id: str, actor: Actor):
    media_id = _owned_media(actor, transcription_id)
    media = sonix("GET", f"/media/{quote(media_id, safe='')}").json()
    status = media.get("status", "preparing")
    transcript = None
    if status == "completed":
        transcript = sonix(
            "GET", f"/media/{quote(media_id, safe='')}/transcript"
        ).text.strip()
    return {"id": transcription_id, "status": status, "transcript": transcript}
