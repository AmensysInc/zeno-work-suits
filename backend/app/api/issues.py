from fastapi import APIRouter, Response
from sqlalchemy import select, or_
from app.api.deps import DB, Actor
from app.models import Project
from app.models import Issue
from app.schemas.issue import IssueIn, IssueOut, IssueUpdate, StatusIn
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
    return db.scalars(query.order_by(Issue.order_index, Issue.id)).all()


@router.post("", response_model=IssueOut, status_code=201)
def create(data: IssueIn, db: DB, actor: Actor):
    return issues.create(db, data, actor)


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
    db.delete(issue_access(db, id, actor))
    db.commit()
    return Response(status_code=204)
