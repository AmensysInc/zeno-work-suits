from fastapi import APIRouter, Response
from sqlalchemy import func, select, or_
from app.api.deps import DB, Actor
from app.models import ActivityLog, Issue, Project
from app.schemas.issue import (
    IssueIn,
    IssueOut,
    IssueUpdate,
    StatusIn,
    BulkIssueUpdate,
)
from app.services.access import visible_projects, project_access, issue_access
from app.services import issues

router = APIRouter(prefix="/issues", tags=["Issues"])


@router.get("", response_model=list[IssueOut])
def index(
    db: DB, actor: Actor, project_id: int | None = None, q: str = "", mine: bool = False
):
    query = select(Issue).where(
        Issue.project_id.in_(visible_projects(actor).with_only_columns(Project.id))
    )
    if project_id:
        project_access(db, project_id, actor)
        query = query.where(Issue.project_id == project_id)
    if q:
        query = query.where(
            or_(Issue.summary.ilike(f"%{q}%"), Issue.issue_key.ilike(f"%{q}%"))
        )
    if mine:
        query = query.where(Issue.assignee_id == actor.id)
    items = db.scalars(query.order_by(Issue.order_index, Issue.id)).all()
    # When each finished issue was last moved to Done, as the reports count it.
    done_ids = [i.id for i in items if i.status == "DONE"]
    resolved = (
        dict(
            db.execute(
                select(ActivityLog.issue_id, func.max(ActivityLog.created_at))
                .where(
                    ActivityLog.issue_id.in_(done_ids),
                    ActivityLog.field_name == "status",
                    ActivityLog.new_value == "DONE",
                )
                .group_by(ActivityLog.issue_id)
            ).all()
        )
        if done_ids
        else {}
    )
    for item in items:
        item.resolved_at = (
            resolved.get(item.id, item.updated_at) if item.status == "DONE" else None
        )
    return items


@router.post("", response_model=IssueOut, status_code=201)
def create(data: IssueIn, db: DB, actor: Actor):
    return issues.create(db, data, actor)


@router.patch("/bulk", response_model=list[IssueOut])
def bulk(data: BulkIssueUpdate, db: DB, actor: Actor):
    return issues.bulk_edit(db, data.ids, data.changes, actor)


@router.get("/{id}", response_model=IssueOut)
def show(id: int, db: DB, actor: Actor):
    return issue_access(db, id, actor)


@router.put("/{id}", response_model=IssueOut)
def edit(id: int, data: IssueUpdate, db: DB, actor: Actor):
    return issues.edit(db, id, data, actor)


@router.patch("/{id}/status", response_model=IssueOut)
def status(id: int, data: StatusIn, db: DB, actor: Actor):
    return issues.edit(db, id, IssueUpdate(status=data.status), actor)


@router.delete("/{id}", status_code=204)
def delete(id: int, db: DB, actor: Actor):
    issues.delete(db, id, actor)
    return Response(status_code=204)
