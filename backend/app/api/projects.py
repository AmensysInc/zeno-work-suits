from fastapi import APIRouter, Response
from app.api.deps import DB, Actor
from app.models import Project
from app.schemas.project import ProjectIn, ProjectOut, ProjectUpdate, MemberIn
from app.services.access import visible_projects, project_access
from app.services import projects

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=list[ProjectOut])
def index(db: DB, actor: Actor):
    return db.scalars(visible_projects(actor).order_by(Project.updated_at.desc())).all()


@router.post("", response_model=ProjectOut, status_code=201)
def create(data: ProjectIn, db: DB, actor: Actor):
    return projects.create(db, data, actor)


@router.get("/{id}", response_model=ProjectOut)
def show(id: int, db: DB, actor: Actor):
    return project_access(db, id, actor)


@router.put("/{id}", response_model=ProjectOut)
def edit(id: int, data: ProjectUpdate, db: DB, actor: Actor):
    return projects.update(db, id, data, actor)


@router.delete("/{id}", status_code=204)
def delete(id: int, db: DB, actor: Actor):
    db.delete(project_access(db, id, actor, owner=True))
    db.commit()
    return Response(status_code=204)


@router.post("/{id}/members", response_model=ProjectOut)
def add_member(id: int, data: MemberIn, db: DB, actor: Actor):
    return projects.add_member(db, id, data.email, actor)
