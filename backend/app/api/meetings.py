from datetime import datetime
from fastapi import APIRouter, Response
from app.api.calls import CallJoin, CallStatus
from app.api.deps import DB, Actor
from app.schemas.meeting import MeetingIn, MeetingOut, Person
from app.services import calls, meetings

router = APIRouter(prefix="/meetings", tags=["Calendar"])


@router.get("/people", response_model=list[Person])
def people(db: DB, actor: Actor):
    """Everyone who can be invited to a meeting."""
    return meetings.people(db)


@router.get("", response_model=list[MeetingOut])
def index(start: datetime, end: datetime, db: DB, actor: Actor):
    return meetings.in_range(db, actor, start, end)


@router.post("", response_model=MeetingOut, status_code=201)
def create(data: MeetingIn, db: DB, actor: Actor):
    return meetings.create(db, actor, data)


@router.get("/{id}", response_model=MeetingOut)
def show(id: int, db: DB, actor: Actor):
    return meetings.visible(db, actor, id)


@router.put("/{id}", response_model=MeetingOut)
def update(id: int, data: MeetingIn, db: DB, actor: Actor):
    return meetings.update(db, actor, id, data)


@router.delete("/{id}", status_code=204)
def delete(id: int, db: DB, actor: Actor):
    meetings.delete(db, actor, id)
    return Response(status_code=204)


@router.get("/{id}/call", response_model=CallStatus)
def call_status(id: int, db: DB, actor: Actor):
    return calls.meeting_status(db, actor, id)


@router.post("/{id}/call/join", response_model=CallJoin)
def call_join(id: int, db: DB, actor: Actor):
    return calls.meeting_join(db, actor, id)
