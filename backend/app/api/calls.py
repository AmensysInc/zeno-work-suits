from fastapi import APIRouter
from pydantic import BaseModel
from app.api.deps import DB, Actor
from app.services import calls

router = APIRouter(tags=["Project calls"])


class CallParticipant(BaseModel):
    identity: str
    name: str
    user_id: int | None = None


class CallStatus(BaseModel):
    enabled: bool
    active: bool
    participants: list[CallParticipant]


class CallJoin(BaseModel):
    url: str
    token: str
    room: str


@router.get("/projects/{project_id}/call", response_model=CallStatus)
def status(project_id: int, db: DB, actor: Actor):
    return calls.status(db, actor, project_id)


@router.post("/projects/{project_id}/call/join", response_model=CallJoin)
def join(project_id: int, db: DB, actor: Actor):
    return calls.join(db, actor, project_id)
