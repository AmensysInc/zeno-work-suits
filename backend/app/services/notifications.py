"""Notifications: the bell in the sidebar and the browser's desktop alerts.

Each event adds one row per person who should hear about it, in the caller's
open transaction, so a change that rolls back never announces itself. The
person who did the thing is never notified about it, and nor is anyone whose
account is disabled.
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import selectinload

from app.models import Notification, User
from app.models.project import project_members

PAGE_SIZE = 30
KEEP_DAYS = 90
LABELS = {
    "status": "Status",
    "priority": "Priority",
    "summary": "Title",
    "description": "Description",
    "issue_type": "Type",
    "story_points": "Story points",
    "sprint_id": "Sprint",
    "epic_id": "Epic",
    "parent_issue_id": "Parent",
    "due_date": "Due date",
    "start_date": "Start date",
    "labels": "Labels",
}
# Shown with their values; the rest are only named ("Description changed").
WITH_VALUES = {"status", "priority", "issue_type", "story_points", "due_date", "start_date"}
# Reordering a card is not news; assignee changes get their own notification.
QUIET_FIELDS = {"order_index", "assignee_id"}


def name(user) -> str:
    return f"{user.first_name} {user.last_name}".strip()


def short(text: str, limit: int = 140) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _pretty(value) -> str:
    if value is None or value == "":
        return "none"
    if isinstance(value, str):
        return value.replace("_", " ").title()
    return str(value)


def notify(db, recipients, actor, kind, title, body="", link=""):
    """Queue a notification for each recipient except the actor (caller commits)."""
    ids = {i for i in recipients if i and i != actor.id}
    if not ids:
        return
    active = db.scalars(select(User.id).where(User.id.in_(ids), User.is_active)).all()
    for uid in sorted(active):
        db.add(
            Notification(
                user_id=uid,
                actor_id=actor.id,
                kind=kind,
                title=short(title, 300),
                body=short(body, 300),
                link=link,
            )
        )


def project_people(db, project) -> set[int]:
    """Everyone on a project's team, plus its owner."""
    ids = set(
        db.scalars(
            select(project_members.c.user_id).where(
                project_members.c.project_id == project.id
            )
        )
    )
    ids.add(project.owner_id)
    return ids


def _issue_link(issue) -> str:
    return f"/issues/{issue.id}"


def issue_created(db, actor, issue, assignee_ids):
    notify(
        db,
        assignee_ids,
        actor,
        "issue_assigned",
        f"{name(actor)} assigned you {issue.issue_key}",
        issue.summary,
        _issue_link(issue),
    )


def issue_changed(db, actor, issue, changes, before_ids, after_ids):
    """changes: [(field, old, new)] already applied to the issue."""
    added = [i for i in after_ids if i not in before_ids]
    removed = [i for i in before_ids if i not in after_ids]
    notify(
        db,
        added,
        actor,
        "issue_assigned",
        f"{name(actor)} assigned you {issue.issue_key}",
        issue.summary,
        _issue_link(issue),
    )
    notify(
        db,
        removed,
        actor,
        "issue_unassigned",
        f"{name(actor)} unassigned you from {issue.issue_key}",
        issue.summary,
        _issue_link(issue),
    )
    shown = [c for c in changes if c[0] not in QUIET_FIELDS]
    if not shown:
        return
    parts = []
    for field, old, new in shown:
        label = LABELS.get(field, field.replace("_", " ").capitalize())
        if field in WITH_VALUES:
            parts.append(f"{label}: {_pretty(old)} → {_pretty(new)}")
        else:
            parts.append(f"{label} changed")
    kind = "issue_status" if any(c[0] == "status" for c in shown) else "issue_updated"
    # Newly assigned people already got "assigned you"; don't tell them twice.
    watchers = (set(after_ids) - set(added)) | {issue.reporter_id}
    notify(
        db,
        watchers,
        actor,
        kind,
        f"{name(actor)} updated {issue.issue_key}: {issue.summary}",
        " · ".join(parts),
        _issue_link(issue),
    )


def issue_commented(db, actor, issue, body):
    notify(
        db,
        {u.id for u in issue.assignees} | {issue.reporter_id},
        actor,
        "comment",
        f"{name(actor)} commented on {issue.issue_key}",
        body,
        _issue_link(issue),
    )


def chat_message(db, actor, project, body):
    notify(
        db,
        project_people(db, project),
        actor,
        "chat",
        f"{name(actor)} in {project.name}",
        body,
        f"/chat?project={project.id}",
    )


def call_started(db, actor, project):
    notify(
        db,
        project_people(db, project),
        actor,
        "call",
        f"{name(actor)} started a video call",
        f"{project.name}: join from the project chat",
        f"/chat?project={project.id}",
    )


def _meeting_people(meeting) -> set[int]:
    return {u.id for u in meeting.attendees} | {meeting.organizer_id}


def meeting_saved(db, actor, meeting, before_ids=None):
    """A new meeting invites everyone; an edit invites newcomers and tells the rest."""
    link = f"/calendar?meeting={meeting.id}"
    people = _meeting_people(meeting)
    invited = people if before_ids is None else people - set(before_ids)
    notify(
        db,
        invited,
        actor,
        "meeting_invite",
        f"{name(actor)} invited you to “{meeting.title}”",
        meeting.description,
        link,
    )
    if before_ids is None:
        return
    notify(
        db,
        people - invited,
        actor,
        "meeting_updated",
        f"{name(actor)} updated “{meeting.title}”",
        "Open the calendar to see the new details",
        link,
    )
    notify(
        db,
        set(before_ids) - people,
        actor,
        "meeting_cancelled",
        f"{name(actor)} removed you from “{meeting.title}”",
        "",
        "/calendar",
    )


def meeting_cancelled(db, actor, meeting):
    notify(
        db,
        _meeting_people(meeting),
        actor,
        "meeting_cancelled",
        f"{name(actor)} cancelled “{meeting.title}”",
        "",
        "/calendar",
    )


def meeting_call_started(db, actor, meeting):
    notify(
        db,
        _meeting_people(meeting),
        actor,
        "call",
        f"{name(actor)} joined the call for “{meeting.title}”",
        "Join from the calendar",
        f"/calendar?meeting={meeting.id}",
    )


# --- The person's own list -------------------------------------------------


def listing(db, actor, limit=PAGE_SIZE):
    limit = max(1, min(limit, 100))
    # Old read notifications are cleared away as people look at their list.
    cutoff = datetime.now(timezone.utc) - timedelta(days=KEEP_DAYS)
    db.execute(
        delete(Notification).where(
            Notification.user_id == actor.id,
            Notification.read_at.is_not(None),
            Notification.created_at < cutoff,
        )
    )
    db.commit()
    items = db.scalars(
        select(Notification)
        .where(Notification.user_id == actor.id)
        .options(selectinload(Notification.actor))
        .order_by(Notification.id.desc())
        .limit(limit)
    ).all()
    unread = db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == actor.id, Notification.read_at.is_(None))
    )
    return {"items": items, "unread": unread}


def mark_read(db, actor, ids=None):
    """Marks the given notifications read, or all of them when ids is None."""
    query = update(Notification).where(
        Notification.user_id == actor.id, Notification.read_at.is_(None)
    )
    if ids is not None:
        if not ids:
            raise HTTPException(422, "Choose notifications to mark as read")
        query = query.where(Notification.id.in_(ids))
    db.execute(query.values(read_at=datetime.now(timezone.utc)))
    db.commit()
