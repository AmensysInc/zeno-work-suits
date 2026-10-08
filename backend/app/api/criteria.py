from fastapi import APIRouter, Response
from sqlalchemy import select
from app.api.deps import DB, Actor
from app.models import AcceptanceCriterion
from app.schemas.criterion import CriterionIn, CriterionOut, ReorderIn
from app.services.access import issue_access, child_access
from app.services import criteria

router = APIRouter(tags=["Acceptance criteria"])


@router.post("/acceptance-criteria/reorder")
def reorder(data: ReorderIn, db: DB, actor: Actor):
    return criteria.reorder(db, actor, data)


@router.get("/issues/{issue_id}/acceptance-criteria", response_model=list[CriterionOut])
def index(issue_id: int, db: DB, actor: Actor):
    issue_access(db, issue_id, actor)
    return db.scalars(
        select(AcceptanceCriterion)
        .where(AcceptanceCriterion.issue_id == issue_id)
        .order_by(AcceptanceCriterion.order_index, AcceptanceCriterion.id)
    ).all()


@router.post(
    "/issues/{issue_id}/acceptance-criteria",
    response_model=CriterionOut,
    status_code=201,
)
def create(issue_id: int, data: CriterionIn, db: DB, actor: Actor):
    return criteria.save(db, actor, data, issue_id=issue_id)


@router.put("/acceptance-criteria/{id}", response_model=CriterionOut)
def edit(id: int, data: CriterionIn, db: DB, actor: Actor):
    return criteria.save(db, actor, data, id=id)


@router.delete("/acceptance-criteria/{id}", status_code=204)
def delete(id: int, db: DB, actor: Actor):
    db.delete(child_access(db, AcceptanceCriterion, id, actor))
    db.commit()
    return Response(status_code=204)
