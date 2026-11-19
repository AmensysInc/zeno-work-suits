"""Calendar meetings: the organizer and the people they invite see a meeting.

A repeating meeting is one row per occurrence, linked by series_id. Changing
or cancelling one asks for a scope: just this one, this and the following
ones, or the whole series.
"""

import calendar
import uuid
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.models import Meeting, User
from app.models.meeting import meeting_attendees
from app.services import notifications
from app.services.access import is_admin, project_access

MAX_RANGE_DAYS = 62
MAX_OCCURRENCES = 100
SCOPES = ("one", "following", "all")
REPEAT_WORDS = {
    "DAILY": "every day",
    "WEEKDAYS": "every weekday",
    "WEEKLY": "every week",
    "BIWEEKLY": "every 2 weeks",
    "MONTHLY": "every month",
}


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


def everyone(meeting) -> set[int]:
    return {u.id for u in meeting.attendees} | {meeting.organizer_id}


def _editable(db, actor, id) -> Meeting:
    meeting = visible(db, actor, id)
    if meeting.organizer_id != actor.id and not is_admin(actor):
        raise HTTPException(403, "Only the organizer can change or cancel this meeting")
    return meeting


def _attendees(db, meeting, data):
    ids = [i for i in dict.fromkeys(data.attendee_ids) if i != meeting.organizer_id]
    attendees = (
        db.scalars(select(User).where(User.id.in_(ids), User.is_active)).all()
        if ids
        else []
    )
    if len(attendees) != len(ids):
        raise HTTPException(422, "Some invited people were not found")
    return attendees


def _apply(db, actor, meeting, data, attendees=None):
    if data.project_id is not None:
        project_access(db, data.project_id, actor)  # only projects the organizer can open
    meeting.title = data.title
    meeting.description = data.description.strip()
    meeting.starts_at = _utc(data.starts_at)
    meeting.ends_at = _utc(data.ends_at)
    meeting.project_id = data.project_id
    meeting.attendees = attendees if attendees is not None else _attendees(db, meeting, data)


def _add_months(day: date, months: int) -> date:
    """The same day of the month, or the month's last day when it is shorter."""
    month0 = day.month - 1 + months
    year, month = day.year + month0 // 12, month0 % 12 + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def occurrences(starts_at, ends_at, repeat, until: date, time_zone=None):
    """(start, end) pairs in UTC for a series, keeping the local clock time."""
    zone = ZoneInfo(time_zone) if time_zone else timezone.utc
    local = _utc(starts_at).astimezone(zone)
    length = _utc(ends_at) - _utc(starts_at)
    first, clock = local.date(), local.timetz().replace(tzinfo=None)

    def dates():
        if repeat in ("DAILY", "WEEKDAYS"):
            day = first
            while True:
                if repeat == "DAILY" or day == first or day.weekday() < 5:
                    yield day
                day += timedelta(days=1)
        step = {"WEEKLY": 7, "BIWEEKLY": 14}.get(repeat)
        n = 0
        while True:
            yield first + timedelta(days=step * n) if step else _add_months(first, n)
            n += 1

    out = []
    for day in dates():
        if day > until or len(out) >= MAX_OCCURRENCES:
            break
        start = datetime.combine(day, clock, tzinfo=zone).astimezone(timezone.utc)
        out.append((start, start + length))
    return out


def describe(meeting) -> str:
    """"Repeats every week until Dec 19, 2026" for a series, else ""."""
    if not meeting.repeat or not meeting.repeat_until:
        return ""
    until = meeting.repeat_until.strftime("%b %d, %Y").replace(" 0", " ")
    return f"Repeats {REPEAT_WORDS.get(meeting.repeat, '')} until {until}"


def create(db, actor, data):
    meeting = Meeting(organizer_id=actor.id, title="", description="")
    attendees = _attendees(db, meeting, data)
    _apply(db, actor, meeting, data, attendees)
    db.add(meeting)
    if data.repeat != "NONE":
        times = occurrences(
            data.starts_at, data.ends_at, data.repeat, data.repeat_until, data.time_zone
        )
        series = str(uuid.uuid4())
        meeting.series_id = series
        meeting.repeat, meeting.repeat_until = data.repeat, data.repeat_until
        for start, end in times[1:]:
            db.add(
                Meeting(
                    organizer_id=actor.id,
                    title=meeting.title,
                    description=meeting.description,
                    starts_at=start,
                    ends_at=end,
                    project_id=meeting.project_id,
                    attendees=list(attendees),
                    series_id=series,
                    repeat=data.repeat,
                    repeat_until=data.repeat_until,
                )
            )
    db.flush()
    notifications.meeting_saved(db, actor, meeting, note=describe(meeting))
    db.commit()
    return visible(db, actor, meeting.id)


def _targets(db, meeting, scope):
    """The occurrences a change applies to, starting with the one picked."""
    if scope not in SCOPES:
        raise HTTPException(422, "Choose one, following or all")
    if scope == "one" or not meeting.series_id:
        return [meeting]
    query = _query().where(Meeting.series_id == meeting.series_id)
    if scope == "following":
        query = query.where(Meeting.starts_at >= meeting.starts_at)
    others = db.scalars(query.order_by(Meeting.starts_at, Meeting.id)).all()
    return [meeting] + [m for m in others if m.id != meeting.id]


def update(db, actor, id, data, scope="one"):
    meeting = _editable(db, actor, id)
    targets = _targets(db, meeting, scope)
    before = everyone(meeting)
    # The other dates move by as much as this one did and take its new length.
    shift = _utc(data.starts_at) - _utc(meeting.starts_at)
    length = _utc(data.ends_at) - _utc(data.starts_at)
    attendees = _attendees(db, meeting, data)
    _apply(db, actor, meeting, data, attendees)
    for other in targets[1:]:
        if other.organizer_id != meeting.organizer_id and not is_admin(actor):
            continue
        other.title = meeting.title
        other.description = meeting.description
        other.project_id = meeting.project_id
        other.attendees = list(attendees)
        other.starts_at = _utc(other.starts_at) + shift
        other.ends_at = other.starts_at + length
    note = f"Changed for {len(targets)} dates" if len(targets) > 1 else ""
    notifications.meeting_saved(db, actor, meeting, before, note=note)
    db.commit()
    return visible(db, actor, id)


def delete(db, actor, id, scope="one"):
    meeting = _editable(db, actor, id)
    targets = _targets(db, meeting, scope)
    note = f"All {len(targets)} dates are cancelled" if len(targets) > 1 else ""
    notifications.meeting_cancelled(db, actor, meeting, note=note)
    for m in targets:
        db.delete(m)
    db.commit()
