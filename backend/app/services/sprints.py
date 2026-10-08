from fastapi import HTTPException
from sqlalchemy import select
from app.models import Sprint, Issue
from app.services.access import project_access, child_access
from app.services.activity import record


def create(db, actor, project_id, data):
    project_access(db, project_id, actor)
    sprint = Sprint(project_id=project_id, **data.model_dump())
    db.add(sprint)
    db.commit()
    return sprint


def edit(db, actor, id, data):
    sprint = child_access(db, Sprint, id, actor)
    if sprint.status == "COMPLETED":
        raise HTTPException(409, "Completed sprints cannot be edited")
    for k, v in data.model_dump().items():
        setattr(sprint, k, v)
    db.commit()
    return sprint


def transition(db, actor, id, target):
    sprint = child_access(db, Sprint, id, actor)
    project_access(db, sprint.project_id, actor, lock=True)
    db.refresh(sprint)
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
                record(
                    db,
                    actor,
                    sprint.project_id,
                    issue.id,
                    "returned unfinished work to backlog",
                    "sprint_id",
                    sprint.id,
                    None,
                )
                issue.sprint_id = None
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
