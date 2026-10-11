from fastapi import APIRouter, Response
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.api.deps import DB, Actor
from app.models import TestExecution, TestCase, Project
from app.schemas.test_execution import ExecutionIn, ExecutionOut
from app.services.access import visible_projects, project_access, child_access
from app.services import executions

router = APIRouter(prefix="/test-executions", tags=["Test executions"])


@router.get("", response_model=list[ExecutionOut])
def index(
    db: DB,
    actor: Actor,
    project_id: int | None = None,
    test_case_id: int | None = None,
    issue_id: int | None = None,
    sprint_id: int | None = None,
):
    query = (
        select(TestExecution)
        .where(
            TestExecution.project_id.in_(
                visible_projects(actor).with_only_columns(Project.id)
            )
        )
        .options(
            selectinload(TestExecution.test_case),
            selectinload(TestExecution.tester),
            selectinload(TestExecution.steps),
        )
    )
    if project_id:
        project_access(db, project_id, actor)
        query = query.where(TestExecution.project_id == project_id)
    if test_case_id:
        query = query.where(TestExecution.test_case_id == test_case_id)
    if issue_id:
        query = query.where(
            TestExecution.test_case_id.in_(
                select(TestCase.id).where(TestCase.issue_id == issue_id)
            )
        )
    if sprint_id:
        query = query.where(TestExecution.sprint_id == sprint_id)
    return db.scalars(
        query.order_by(TestExecution.executed_on.desc(), TestExecution.id.desc())
    ).all()


@router.post("", response_model=ExecutionOut, status_code=201)
def create(data: ExecutionIn, db: DB, actor: Actor):
    return executions.save(db, actor, data)


@router.get("/{id}", response_model=ExecutionOut)
def show(id: int, db: DB, actor: Actor):
    return child_access(db, TestExecution, id, actor)


@router.put("/{id}", response_model=ExecutionOut)
def edit(id: int, data: ExecutionIn, db: DB, actor: Actor):
    return executions.save(db, actor, data, id)


@router.delete("/{id}", status_code=204)
def delete(id: int, db: DB, actor: Actor):
    executions.delete(db, actor, id)
    return Response(status_code=204)
