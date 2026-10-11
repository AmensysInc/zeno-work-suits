from datetime import date
from fastapi import HTTPException
from sqlalchemy import select
from app.models import TestCase, TestExecution, TestExecutionStep, Sprint
from app.services.access import project_access, child_access
from app.services.activity import record


def sync_status(db, test_case):
    """A test case's status mirrors its most recent run."""
    db.flush()
    test_case.status = (
        db.scalar(
            select(TestExecution.status)
            .where(TestExecution.test_case_id == test_case.id)
            .order_by(TestExecution.executed_on.desc(), TestExecution.id.desc())
            .limit(1)
        )
        or "NOT_RUN"
    )


def resolve_sprint(db, project, data, current):
    if "sprint_id" not in data.model_fields_set:
        if current:
            return current.sprint_id
        return db.scalar(
            select(Sprint.id).where(
                Sprint.project_id == project.id, Sprint.status == "ACTIVE"
            )
        )
    if data.sprint_id is not None:
        sprint = db.get(Sprint, data.sprint_id)
        if not sprint or sprint.project_id != project.id:
            raise HTTPException(422, "Choose a sprint in this project")
    return data.sprint_id


def save(db, actor, data, id=None):
    test_case = child_access(db, TestCase, data.test_case_id, actor)
    project = project_access(db, test_case.project_id, actor)
    item = child_access(db, TestExecution, id, actor) if id else None
    if item and item.test_case_id != test_case.id:
        raise HTTPException(422, "A test run cannot move to another test case")
    tester_id = data.tester_id or actor.id
    if tester_id not in {u.id for u in project.members} | {project.owner_id}:
        raise HTTPException(422, "Tester must be a project member")
    results = {s.step_number: s for s in data.steps}
    if len(results) != len(data.steps):
        raise HTTPException(422, "Record each step result once")
    sprint_id = resolve_sprint(db, project, data, item)
    if not item:
        item = TestExecution(project_id=project.id, test_case_id=test_case.id)
        # Snapshot the steps so later edits to the test case keep run history intact.
        item.steps = [
            TestExecutionStep(
                step_number=s.step_number,
                action=s.action,
                test_data=s.test_data,
                expected_result=s.expected_result,
            )
            for s in test_case.steps
        ]
        db.add(item)
    if set(results) - {s.step_number for s in item.steps}:
        raise HTTPException(422, "Step results must match the test case steps")
    for step in item.steps:
        if step.step_number in results:
            step.status = results[step.step_number].status
            step.actual_result = results[step.step_number].actual_result
    item.status = data.status
    item.actual_result = data.actual_result
    item.environment = data.environment
    item.tester_id = tester_id
    item.executed_on = data.executed_on or item.executed_on or date.today()
    item.sprint_id = sprint_id
    sync_status(db, test_case)
    record(
        db,
        actor,
        project.id,
        test_case.issue_id,
        "updated test run" if id else "recorded test run",
        test_case.test_case_key,
        None,
        data.status,
    )
    db.commit()
    return item


def delete(db, actor, id):
    item = child_access(db, TestExecution, id, actor)
    test_case = item.test_case
    db.delete(item)
    sync_status(db, test_case)
    record(
        db,
        actor,
        item.project_id,
        test_case.issue_id,
        "deleted test run",
        test_case.test_case_key,
        item.status,
        None,
    )
    db.commit()
