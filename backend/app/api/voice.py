import hashlib
import hmac
from urllib.parse import quote
import httpx
from fastapi import APIRouter, HTTPException, Query, UploadFile
from app.api.deps import Actor
from app.core.config import settings

router = APIRouter(prefix="/voice", tags=["Voice agent"])
SONIOX_URL = "https://api.soniox.com/v1"
MAX_UPLOAD_BYTES = 25 * 1024 * 1024


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
            timeout=60,
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
    if response.status_code == 404:
        raise HTTPException(404, "Recording not found")
    if response.status_code >= 400:
        try:
            detail = response.json().get("error_message") or ""
        except ValueError:
            detail = ""
        raise HTTPException(
            502, f"Soniox error {response.status_code}{f': {detail}' if detail else ''}"
        )
    return response


def _cleanup(transcription_id: str, file_id: str | None) -> None:
    """Soniox keeps uploads until deleted; remove them once the transcript is read."""
    for path in (
        f"/transcriptions/{quote(transcription_id, safe='')}",
        f"/files/{quote(file_id, safe='')}" if file_id else None,
    ):
        if path:
            try:
                soniox("DELETE", path)
            except HTTPException:
                pass  # Cleanup is best effort; the transcript is already in hand.


def _signature(actor, transcription_id: str) -> str:
    message = f"voice:{actor.id}:{transcription_id}".encode()
    return hmac.new(settings.jwt_secret.encode(), message, hashlib.sha256).hexdigest()[
        :32
    ]


def _owned(actor, signed_id: str) -> str:
    """The Soniox transcription id, only for the person who uploaded the recording."""
    transcription_id, _, signature = signed_id.rpartition(".")
    if not transcription_id or not hmac.compare_digest(
        signature, _signature(actor, transcription_id)
    ):
        raise HTTPException(404, "Recording not found")
    return transcription_id


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
    uploaded = soniox(
        "POST",
        "/files",
        files={"file": (file.filename or "voice.webm", audio, file.content_type)},
    ).json()
    transcription = soniox(
        "POST",
        "/transcriptions",
        json={
            "model": settings.soniox_model,
            "file_id": uploaded["id"],
            "language_hints": [language.split("-")[0]],
            "client_reference_id": f"zeno-voice-{actor.id}",
        },
    ).json()
    # Soniox ids are shared across the account; the signed id ties this one to its uploader.
    transcription_id = str(transcription["id"])
    return {
        "id": f"{transcription_id}.{_signature(actor, transcription_id)}",
        "status": transcription.get("status", "queued"),
    }


@router.get("/transcriptions/{signed_id}")
def show(signed_id: str, actor: Actor):
    transcription_id = _owned(actor, signed_id)
    item = soniox("GET", f"/transcriptions/{quote(transcription_id, safe='')}").json()
    status = item.get("status", "queued")
    transcript = None
    error = None
    if status == "completed":
        transcript = (
            soniox(
                "GET", f"/transcriptions/{quote(transcription_id, safe='')}/transcript"
            )
            .json()
            .get("text", "")
            .strip()
        )
        _cleanup(transcription_id, item.get("file_id"))
    elif status == "error":
        # The page treats "failed" as final and shows the reason.
        status = "failed"
        error = (
            item.get("error_message") or "Soniox could not transcribe this recording"
        )
        _cleanup(transcription_id, item.get("file_id"))
    return {"id": signed_id, "status": status, "transcript": transcript, "error": error}
