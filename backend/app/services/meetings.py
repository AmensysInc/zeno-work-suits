"""Calendar meetings: the organizer and the people they invite see a meeting."""

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.models import Meeting, User
from app.models.meeting import meeting_attendees
from app.services.access import is_admin, project_access

MAX_RANGE_DAYS = 62


def _query():
    return select(Meeting).options(
        selectinload(Meeting.organizer),
        selectinload(Meeting.attendees),
        selectinload(Meeting.project),
    )


def _invited(actor):
    """Meetings the person organizes or is invited to."""
    return or_(
        Meeting.organizer_id == actor.id,
        Meeting.id.in_(
            select(meeting_attendees.c.meeting_id).where(
                meeting_attendees.c.user_id == actor.id
            )
        ),
    )


def people(db):
    """Everyone who can be invited: all active people (anyone in the company)."""
    return db.scalars(
        select(User)
        .where(User.is_active)
        .order_by(User.first_name, User.last_name, User.id)
    ).all()


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def in_range(db, actor, start: datetime, end: datetime):
    """The person's meetings that overlap [start, end), earliest first."""
    start, end = _utc(start), _utc(end)
    if end <= start:
        raise HTTPException(422, "The range must end after it starts")
    if (end - start).days > MAX_RANGE_DAYS:
        raise HTTPException(422, f"Ask for at most {MAX_RANGE_DAYS} days at a time")
    return db.scalars(
        _query()
        .where(_invited(actor), Meeting.starts_at < end, Meeting.ends_at > start)
        .order_by(Meeting.starts_at, Meeting.id)
    ).all()


def visible(db, actor, id) -> Meeting:
    """A meeting the person may see and join: organizer, invited, or an admin."""
    meeting = db.scalar(_query().where(Meeting.id == id))
    if not meeting or not (
        is_admin(actor)
        or meeting.organizer_id == actor.id
        or any(u.id == actor.id for u in meeting.attendees)
    ):
        raise HTTPException(404, "Meeting not found")
    return meeting


def _editable(db, actor, id) -> Meeting:
    meeting = visible(db, actor, id)
    if meeting.organizer_id != actor.id and not is_admin(actor):
        raise HTTPException(403, "Only the organizer can change or cancel this meeting")
    return meeting


def _apply(db, actor, meeting, data):
    if data.project_id is not None:
        project_access(db, data.project_id, actor)  # only projects the organizer can open
    ids = [i for i in dict.fromkeys(data.attendee_ids) if i != meeting.organizer_id]
    attendees = (
        db.scalars(select(User).where(User.id.in_(ids), User.is_active)).all()
        if ids
        else []
    )
    if len(attendees) != len(ids):
        raise HTTPException(422, "Some invited people were not found")
    meeting.title = data.title
    meeting.description = data.description.strip()
    meeting.starts_at = _utc(data.starts_at)
    meeting.ends_at = _utc(data.ends_at)
    meeting.project_id = data.project_id
    meeting.attendees = attendees


def create(db, actor, data):
    meeting = Meeting(organizer_id=actor.id, title="", description="")
    _apply(db, actor, meeting, data)
    db.add(meeting)
    db.commit()
    return visible(db, actor, meeting.id)


def update(db, actor, id, data):
    meeting = _editable(db, actor, id)
    _apply(db, actor, meeting, data)
    db.commit()
    return visible(db, actor, id)


def delete(db, actor, id):
    db.delete(_editable(db, actor, id))
    db.commit()
