from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models import Issue, Sprint, ActivityLog
from app.services.access import project_access

RETURNED = "returned unfinished work to backlog"


def _day(value):
    return value.date() if isinstance(value, datetime) else value


def _counts(items, field, values):
    return [
        {"key": v, "count": sum(1 for i in items if getattr(i, field) == v)}
        for v in values
    ]


def project_report(db, project_id, actor, sprint_id=None, today=None):
    project = project_access(db, project_id, actor)
    today = today or datetime.now(timezone.utc).date()
    issues = db.scalars(
        select(Issue)
        .where(Issue.project_id == project_id)
        .options(selectinload(Issue.assignee))
    ).all()
    by_id = {i.id: i for i in issues}
    sprints = db.scalars(
        select(Sprint).where(Sprint.project_id == project_id).order_by(Sprint.id)
    ).all()
    logs = db.scalars(
        select(ActivityLog)
        .where(ActivityLog.project_id == project_id, ActivityLog.issue_id.is_not(None))
        .order_by(ActivityLog.created_at, ActivityLog.id)
    ).all()

    # When each finished issue was last moved to Done (seeded or imported
    # work without history falls back to its last update).
    done_on = {}
    for log in logs:
        if log.field_name == "status" and log.new_value == "DONE":
            done_on[log.issue_id] = _day(log.created_at)
    for i in issues:
        if i.status == "DONE":
            done_on.setdefault(i.id, _day(i.updated_at))
        else:
            done_on.pop(i.id, None)

    # Work a sprint committed to but did not finish was moved out on completion.
    returned = {}
    for log in logs:
        if log.action == RETURNED and log.old_value:
            returned.setdefault(int(log.old_value), set()).add(log.issue_id)

    def scope(sprint):
        ids = {i.id for i in issues if i.sprint_id == sprint.id}
        ids |= {i for i in returned.get(sprint.id, ()) if i in by_id}
        return [by_id[i] for i in ids]

    work = [i for i in issues if i.issue_type != "EPIC"]
    velocity = []
    for s in sprints:
        if s.status == "PLANNED":
            continue
        items = scope(s)
        completed = [i for i in items if i.sprint_id == s.id and i.status == "DONE"]
        velocity.append(
            {
                "sprint_id": s.id,
                "name": s.name,
                "status": s.status,
                "committed_points": sum(i.story_points for i in items),
                "completed_points": sum(i.story_points for i in completed),
                "committed_issues": len(items),
                "completed_issues": len(completed),
            }
        )

    chosen = next((s for s in sprints if s.id == sprint_id), None) or next(
        (s for s in sprints if s.status == "ACTIVE"),
        next((s for s in reversed(sprints) if s.status == "COMPLETED"), None),
    )
    burndown = None
    if chosen and chosen.start_date and chosen.end_date:
        items = scope(chosen)
        total = sum(i.story_points for i in items)
        length = max((chosen.end_date - chosen.start_date).days, 1)
        days = []
        for n in range(length + 1):
            day = chosen.start_date + timedelta(days=n)
            remaining = None
            if day <= today:
                remaining = total - sum(
                    i.story_points
                    for i in items
                    if i.sprint_id == chosen.id
                    and i.id in done_on
                    and done_on[i.id] <= day
                )
            days.append(
                {
                    "date": day,
                    "remaining": remaining,
                    "ideal": round(total * (1 - n / length), 1),
                }
            )
        burndown = {
            "sprint_id": chosen.id,
            "name": chosen.name,
            "total_points": total,
            "days": days,
        }

    members = {u.id: u for u in project.members}
    members.setdefault(project.owner.id, project.owner)
    workload = []
    for u in list(members.values()) + [None]:
        mine = [i for i in work if i.assignee_id == (u.id if u else None)]
        open_ = [i for i in mine if i.status != "DONE"]
        if not u and not open_:
            continue
        workload.append(
            {
                "user": u
                and {"id": u.id, "first_name": u.first_name, "last_name": u.last_name},
                "open_issues": len(open_),
                "open_points": sum(i.story_points for i in open_),
                "in_progress": sum(
                    1
                    for i in open_
                    if i.status in ("IN_PROGRESS", "CODE_REVIEW", "TESTING")
                ),
                "done_issues": len(mine) - len(open_),
            }
        )

    week_start = today - timedelta(days=today.weekday())
    weeks = []
    for n in range(7, -1, -1):
        start = week_start - timedelta(weeks=n)
        end = start + timedelta(days=7)
        weeks.append(
            {
                "week": start,
                "created": sum(1 for i in work if start <= _day(i.created_at) < end),
                "resolved": sum(
                    1 for i in work if i.id in done_on and start <= done_on[i.id] < end
                ),
            }
        )

    lead_times = [
        (done_on[i.id] - _day(i.created_at)).days for i in work if i.id in done_on
    ]
    finished = [v for v in velocity if v["status"] == "COMPLETED"]
    done_points = sum(i.story_points for i in work if i.status == "DONE")
    total_points = sum(i.story_points for i in work)
    return {
        "summary": {
            "total_issues": len(work),
            "open_issues": sum(1 for i in work if i.status != "DONE"),
            "done_issues": sum(1 for i in work if i.status == "DONE"),
            "total_points": total_points,
            "done_points": done_points,
            "open_bugs": sum(
                1 for i in work if i.issue_type == "BUG" and i.status != "DONE"
            ),
            "average_velocity": (
                round(sum(v["completed_points"] for v in finished) / len(finished), 1)
                if finished
                else None
            ),
            "average_lead_time_days": (
                round(sum(lead_times) / len(lead_times), 1) if lead_times else None
            ),
        },
        "by_status": _counts(
            work,
            "status",
            ["BACKLOG", "TODO", "IN_PROGRESS", "CODE_REVIEW", "TESTING", "DONE"],
        ),
        "by_type": _counts(work, "issue_type", ["STORY", "TASK", "BUG", "SUBTASK"]),
        "by_priority": _counts(work, "priority", ["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
        "velocity": velocity,
        "burndown": burndown,
        "workload": workload,
        "created_vs_resolved": weeks,
    }
