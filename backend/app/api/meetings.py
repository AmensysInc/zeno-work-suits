from datetime import datetime
from typing import Literal
from fastapi import APIRouter, Response
from app.api.calls import CallJoin, CallStatus
from app.api.deps import DB, Actor
from app.schemas.meeting import MeetingIn, MeetingOut, MessageIn, MessageOut, Person, TranscriptOut
from app.services import calls, meetings, transcripts

Scope = Literal["one", "following", "all"]

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
def update(id: int, data: MeetingIn, db: DB, actor: Actor, scope: Scope = "one"):
    """scope: this meeting, this and the following ones, or the whole series."""
    return meetings.update(db, actor, id, data, scope)


@router.delete("/{id}", status_code=204)
def delete(id: int, db: DB, actor: Actor, scope: Scope = "one"):
    meetings.delete(db, actor, id, scope)
    return Response(status_code=204)


@router.get("/{id}/messages", response_model=list[MessageOut])
def messages(id: int, db: DB, actor: Actor):
    return transcripts.messages(db, actor, id)


@router.post("/{id}/messages", response_model=MessageOut, status_code=201)
def post_message(id: int, data: MessageIn, db: DB, actor: Actor):
    return transcripts.post(db, actor, id, data.body)


@router.delete("/messages/{message_id}", status_code=204)
def delete_message(message_id: int, db: DB, actor: Actor):
    transcripts.delete_message(db, actor, message_id)
    return Response(status_code=204)


@router.get("/{id}/transcripts", response_model=list[TranscriptOut])
def meeting_transcripts(id: int, db: DB, actor: Actor):
    return transcripts.for_meeting(db, actor, id)


@router.get("/{id}/call", response_model=CallStatus)
def call_status(id: int, db: DB, actor: Actor):
    return calls.meeting_status(db, actor, id)


@router.post("/{id}/call/join", response_model=CallJoin)
def call_join(id: int, db: DB, actor: Actor):
    return calls.meeting_join(db, actor, id)
