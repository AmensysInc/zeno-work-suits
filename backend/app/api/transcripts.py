from fastapi import APIRouter, Response
from app.api.deps import DB, Actor
from app.schemas.meeting import TranscriptOut, TranscriptSave, TranscriptStart
from app.services import transcripts

router = APIRouter(tags=["Call transcripts"])


@router.get("/projects/{project_id}/transcripts", response_model=list[TranscriptOut])
def project_transcripts(project_id: int, db: DB, actor: Actor):
    return transcripts.for_project(db, actor, project_id)


@router.post("/calls/transcripts", response_model=TranscriptOut, status_code=201)
def start(data: TranscriptStart, db: DB, actor: Actor):
    """Starts recording a meeting's or a project's call."""
    return transcripts.start(db, actor, data)


@router.put("/calls/transcripts/{id}", response_model=TranscriptOut)
def save(id: int, data: TranscriptSave, db: DB, actor: Actor):
    return transcripts.save(db, actor, id, data)


@router.delete("/calls/transcripts/{id}", status_code=204)
def delete(id: int, db: DB, actor: Actor):
    transcripts.delete(db, actor, id)
    return Response(status_code=204)
