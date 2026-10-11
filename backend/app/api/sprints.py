from fastapi import APIRouter
from sqlalchemy import select
from app.api.deps import DB, Actor
from app.models import Sprint
from app.schemas.sprint import SprintIn, SprintOut
from app.services.access import project_access
from app.services import sprints

router = APIRouter(tags=["Sprints"])


@router.get("/projects/{project_id}/sprints", response_model=list[SprintOut])
def index(project_id: int, db: DB, actor: Actor):
    project_access(db, project_id, actor)
    return db.scalars(
        select(Sprint).where(Sprint.project_id == project_id).order_by(Sprint.id.desc())
    ).all()


@router.post(
    "/projects/{project_id}/sprints", response_model=SprintOut, status_code=201
)
def create(project_id: int, data: SprintIn, db: DB, actor: Actor):
    return sprints.create(db, actor, project_id, data)


@router.put("/sprints/{id}", response_model=SprintOut)
def edit(id: int, data: SprintIn, db: DB, actor: Actor):
    return sprints.edit(db, actor, id, data)


@router.post("/sprints/{id}/start", response_model=SprintOut)
def start(id: int, db: DB, actor: Actor):
    return sprints.transition(db, actor, id, "ACTIVE")


@router.post("/sprints/{id}/complete", response_model=SprintOut)
def complete(id: int, db: DB, actor: Actor):
    return sprints.transition(db, actor, id, "COMPLETED")
