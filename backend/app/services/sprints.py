from fastapi import HTTPException
from sqlalchemy import select
from app.models import Sprint, Issue
from app.services.access import project_access, child_access, require_lead
from app.services.activity import record


def create(db, actor, project_id, data):
    require_lead(db, actor, project_access(db, project_id, actor))
    sprint = Sprint(project_id=project_id, **data.model_dump())
    db.add(sprint)
    db.commit()
    return sprint


def edit(db, actor, id, data):
    sprint = child_access(db, Sprint, id, actor)
    require_lead(db, actor, sprint.project)
    if sprint.status == "COMPLETED":
        raise HTTPException(409, "Completed sprints cannot be edited")
    for k, v in data.model_dump().items():
        setattr(sprint, k, v)
    db.commit()
    return sprint


def delete(db, actor, id):
    sprint = child_access(db, Sprint, id, actor)
    require_lead(db, actor, project_access(db, sprint.project_id, actor, lock=True))
    db.refresh(sprint)
    if sprint.status != "PLANNED":
        raise HTTPException(409, "Only a planned sprint can be deleted")
    for issue in list(sprint.issues):
        issue.sprint_id = None
        if issue.status == "TODO":
            issue.status = "BACKLOG"
    record(db, actor, sprint.project_id, None, "deleted sprint", new=sprint.name)
    db.delete(sprint)
    db.commit()


def transition(db, actor, id, target, move_to=None):
    sprint = child_access(db, Sprint, id, actor)
    require_lead(db, actor, project_access(db, sprint.project_id, actor, lock=True))
    db.refresh(sprint)
    next_sprint = None
    if move_to is not None:
        next_sprint = db.get(Sprint, move_to)
        if (
            target != "COMPLETED"
            or not next_sprint
            or next_sprint.project_id != sprint.project_id
            or next_sprint.status != "PLANNED"
        ):
            raise HTTPException(422, "Move unfinished work to a planned sprint")
    if target == "ACTIVE":
        if sprint.status != "PLANNED":
            raise HTTPException(409, "Only a planned sprint can start")
        if not sprint.start_date or not sprint.end_date:
            raise HTTPException(422, "Set start and end dates before starting")
        if db.scalar(
            select(Sprint.id).where(
                Sprint.project_id == sprint.project_id, Sprint.status == "ACTIVE"
            )
        ):
            raise HTTPException(409, "Complete the current active sprint first")
        for issue in sprint.issues:
            if issue.status == "BACKLOG":
                issue.status = "TODO"
    else:
        if sprint.status != "ACTIVE":
            raise HTTPException(409, "Only an active sprint can complete")
        for issue in list(sprint.issues):
            if issue.status != "DONE":
                # Reports read this entry to know what the sprint committed to.
                record(
                    db,
                    actor,
                    sprint.project_id,
                    issue.id,
                    "returned unfinished work to backlog",
                    "sprint_id",
                    sprint.id,
                    next_sprint.id if next_sprint else None,
                )
                issue.sprint_id = next_sprint.id if next_sprint else None
                if not next_sprint:
                    issue.status = "BACKLOG"
    sprint.status = target
    record(
        db,
        actor,
        sprint.project_id,
        None,
        "started sprint" if target == "ACTIVE" else "completed sprint",
        new=sprint.name,
    )
    db.commit()
    return sprint
