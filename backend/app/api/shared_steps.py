from fastapi import APIRouter, Response
from sqlalchemy import select
from app.api.deps import DB, Actor
from app.models import SharedStep
from app.schemas.test_case import SharedStepIn, SharedStepOut
from app.services.access import project_access, child_access
from app.services import shared_steps

router = APIRouter(prefix="/shared-steps", tags=["Reusable test steps"])


@router.get("", response_model=list[SharedStepOut])
def index(project_id: int, db: DB, actor: Actor):
    project_access(db, project_id, actor)
    return db.scalars(
        select(SharedStep)
        .where(SharedStep.project_id == project_id)
        .order_by(SharedStep.title)
    ).all()


@router.post("", response_model=SharedStepOut, status_code=201)
def create(data: SharedStepIn, db: DB, actor: Actor):
    return shared_steps.save(db, actor, data)


@router.put("/{id}", response_model=SharedStepOut)
def edit(id: int, data: SharedStepIn, db: DB, actor: Actor):
    return shared_steps.save(db, actor, data, id)


@router.delete("/{id}", status_code=204)
def delete(id: int, db: DB, actor: Actor):
    db.delete(child_access(db, SharedStep, id, actor))
    db.commit()
    return Response(status_code=204)
