import httpx
from fastapi import APIRouter, HTTPException, UploadFile
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


@router.post("/transcriptions", status_code=201)
async def create(file: UploadFile, actor: Actor, language: str = "en"):
    audio = await file.read()
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
    return {"id": media["id"], "status": media.get("status", "preparing")}


@router.get("/transcriptions/{media_id}")
def show(media_id: str, actor: Actor):
    media = sonix("GET", f"/media/{media_id}").json()
    status = media.get("status", "preparing")
    transcript = None
    if status == "completed":
        transcript = sonix("GET", f"/media/{media_id}/transcript").text.strip()
    return {"id": media_id, "status": status, "transcript": transcript}
