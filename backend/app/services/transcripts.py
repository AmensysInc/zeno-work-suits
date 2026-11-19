"""Meeting chat, and Soniox transcripts of meeting and project calls.

The browser of the person who presses Record streams the call's audio to
Soniox and saves the text here every few seconds; on Stop the transcript is
marked done and shows in the meeting's chat (or the project chat).
"""

import re
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models import CallTranscript, MeetingMessage, Project
from app.services import meetings, notifications
from app.services.access import can_lead, is_admin, project_access

# A recording that has not saved for this long was cut off (tab closed, network).
STALE_AFTER = timedelta(minutes=2)
LANGUAGE = re.compile(r"^[a-z]{2,3}(-[A-Za-z]{2,4})?$")


def _now():
    return datetime.now(timezone.utc)


def _utc(value):
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


# --- Meeting chat -----------------------------------------------------------


def messages(db, actor, meeting_id):
    meetings.visible(db, actor, meeting_id)
    return db.scalars(
        select(MeetingMessage)
        .where(MeetingMessage.meeting_id == meeting_id)
        .options(selectinload(MeetingMessage.user))
        .order_by(MeetingMessage.created_at, MeetingMessage.id)
    ).all()


def post(db, actor, meeting_id, body):
    meeting = meetings.visible(db, actor, meeting_id)
    message = MeetingMessage(meeting_id=meeting.id, user_id=actor.id, body=body)
    db.add(message)
    notifications.meeting_message(db, actor, meeting, body)
    db.commit()
    db.refresh(message)
    return message


def delete_message(db, actor, id):
    message = db.get(MeetingMessage, id)
    if not message:
        raise HTTPException(404, "Message not found")
    meeting = meetings.visible(db, actor, message.meeting_id)
    if message.user_id != actor.id and meeting.organizer_id != actor.id and not is_admin(actor):
        raise HTTPException(403, "You can only delete your own messages")
    db.delete(message)
    db.commit()


# --- Transcripts ------------------------------------------------------------


def _shown(transcript):
    """Reports a recording that stopped saving as INTERRUPTED."""
    if transcript.status == "RECORDING" and _now() - _utc(transcript.updated_at) > STALE_AFTER:
        transcript.status = "INTERRUPTED"
    return transcript


def _list(db, where):
    rows = db.scalars(
        select(CallTranscript)
        .where(where)
        .options(selectinload(CallTranscript.user))
        .order_by(CallTranscript.started_at, CallTranscript.id)
    ).all()
    out = [_shown(t) for t in rows]
    db.expunge_all()  # the INTERRUPTED label is for display only, never saved
    return out


def for_meeting(db, actor, meeting_id):
    meetings.visible(db, actor, meeting_id)
    return _list(db, CallTranscript.meeting_id == meeting_id)


def for_project(db, actor, project_id):
    project_access(db, project_id, actor)
    return _list(db, CallTranscript.project_id == project_id)


def start(db, actor, data):
    """Starts a recording; only one may run per call at a time."""
    if data.meeting_id is not None:
        meetings.visible(db, actor, data.meeting_id)
        same_call = CallTranscript.meeting_id == data.meeting_id
    else:
        project_access(db, data.project_id, actor)
        same_call = CallTranscript.project_id == data.project_id
    running = db.scalar(
        select(CallTranscript)
        .where(
            same_call,
            CallTranscript.status == "RECORDING",
            CallTranscript.updated_at > _now() - STALE_AFTER,
        )
        .options(selectinload(CallTranscript.user))
    )
    if running and running.user_id != actor.id:
        who = notifications.name(running.user)
        raise HTTPException(409, f"{who} is already recording this call")
    if running:
        return running  # the same person pressed Record again (e.g. after a reload)
    transcript = CallTranscript(
        meeting_id=data.meeting_id,
        project_id=data.project_id,
        user_id=actor.id,
        status="RECORDING",
        text="",
        languages=[],
    )
    db.add(transcript)
    db.commit()
    db.refresh(transcript)
    return transcript


def _own(db, actor, id) -> CallTranscript:
    transcript = db.get(CallTranscript, id)
    if not transcript or transcript.user_id != actor.id:
        raise HTTPException(404, "Transcript not found")
    return transcript


def save(db, actor, id, data):
    """Saves the text so far; finished=True ends the recording and tells people."""
    transcript = _own(db, actor, id)
    if transcript.status == "DONE":
        raise HTTPException(409, "This recording has already ended")
    transcript.text = data.text
    transcript.languages = [
        code for code in dict.fromkeys(data.languages) if LANGUAGE.match(code)
    ]
    transcript.updated_at = _now()
    transcript.status = "RECORDING"
    if data.finished:
        transcript.status = "DONE"
        transcript.ended_at = transcript.updated_at
        if transcript.meeting_id is not None:
            meeting = meetings.visible(db, actor, transcript.meeting_id)
            notifications.transcript_ready(db, actor, transcript, meeting=meeting)
        else:
            project = db.get(Project, transcript.project_id)
            notifications.transcript_ready(db, actor, transcript, project=project)
    db.commit()
    db.refresh(transcript)
    return transcript


def delete(db, actor, id):
    """The recorder, the meeting organizer, a project lead or an admin may delete."""
    transcript = db.get(CallTranscript, id)
    if not transcript:
        raise HTTPException(404, "Transcript not found")
    if transcript.meeting_id is not None:
        meeting = meetings.visible(db, actor, transcript.meeting_id)
        allowed = meeting.organizer_id == actor.id
    else:
        project = project_access(db, transcript.project_id, actor)
        allowed = can_lead(db, actor, project)
    if not (allowed or transcript.user_id == actor.id or is_admin(actor)):
        raise HTTPException(403, "Only the person who recorded it can delete this transcript")
    db.delete(transcript)
    db.commit()
