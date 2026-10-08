from fastapi import APIRouter, Response
from sqlalchemy import select
from app.api.deps import DB, Actor
from app.models import TestCase, Project
from app.schemas.test_case import TestCaseIn, TestCaseOut, TestStatusIn
from app.services.access import visible_projects, child_access, issue_access
from app.services import test_cases

router = APIRouter(prefix="/test-cases", tags=["Test cases"])


@router.get("", response_model=list[TestCaseOut])
def index(db: DB, actor: Actor, issue_id: int | None = None):
    query = select(TestCase).where(
        TestCase.project_id.in_(visible_projects(actor).with_only_columns(Project.id))
    )
    if issue_id:
        issue_access(db, issue_id, actor)
        query = query.where(TestCase.issue_id == issue_id)
    return db.scalars(query.order_by(TestCase.id)).all()


@router.post("", response_model=TestCaseOut, status_code=201)
def create(data: TestCaseIn, db: DB, actor: Actor):
    return test_cases.save(db, actor, data)


@router.get("/{id}", response_model=TestCaseOut)
def show(id: int, db: DB, actor: Actor):
    return child_access(db, TestCase, id, actor)


@router.put("/{id}", response_model=TestCaseOut)
def edit(id: int, data: TestCaseIn, db: DB, actor: Actor):
    return test_cases.save(db, actor, data, id)


@router.patch("/{id}/status", response_model=TestCaseOut)
def status(id: int, data: TestStatusIn, db: DB, actor: Actor):
    return test_cases.status(db, actor, id, data.status)


@router.delete("/{id}", status_code=204)
def delete(id: int, db: DB, actor: Actor):
    db.delete(child_access(db, TestCase, id, actor))
    db.commit()
    return Response(status_code=204)
