from fastapi import HTTPException
from sqlalchemy import select
from app.models import AcceptanceCriterion
from app.services.access import issue_access, child_access
from app.services.activity import record


def reorder(db, actor, data):
    issue = issue_access(db, data.issue_id, actor)
    items = db.scalars(
        select(AcceptanceCriterion).where(AcceptanceCriterion.issue_id == data.issue_id)
    ).all()
    if len(data.ids) != len(set(data.ids)) or set(data.ids) != {i.id for i in items}:
        raise HTTPException(422, "Provide every criterion exactly once")
    positions = {id: index for index, id in enumerate(data.ids)}
    for item in items:
        item.order_index = positions[item.id]
    record(db, actor, issue.project_id, issue.id, "reordered acceptance criteria")
    db.commit()
    return {"ok": True}


def save(db, actor, data, issue_id=None, id=None):
    item = child_access(db, AcceptanceCriterion, id, actor) if id else None
    issue = issue_access(db, item.issue_id if item else issue_id, actor)
    if issue.issue_type != "STORY":
        raise HTTPException(422, "Acceptance criteria belong to stories")
    if item:
        for key, value in data.model_dump().items():
            setattr(item, key, value)
    else:
        item = AcceptanceCriterion(issue_id=issue.id, **data.model_dump())
        db.add(item)
    record(
        db,
        actor,
        issue.project_id,
        issue.id,
        "updated acceptance criterion" if id else "added acceptance criterion",
        new=data.description,
    )
    db.commit()
    return item
