from fastapi import HTTPException
from sqlalchemy import select, update
from app.models import (
    TestCase,
    TestCaseStep,
    Project,
    SharedStep,
    AcceptanceCriterion,
)
from app.services.access import (
    project_access,
    issue_access,
    child_access,
    require_lead,
)
from app.services.activity import record


def delete(db, actor, id):
    item = child_access(db, TestCase, id, actor)
    require_lead(db, actor, db.get(Project, item.project_id))
    record(db, actor, item.project_id, item.issue_id, "deleted test case", new=item.test_case_key)
    db.delete(item)
    db.commit()


def build_steps(db, project_id, steps):
    """Turns submitted steps into rows; reusable steps copy their library text."""
    rows = []
    for number, step in enumerate(steps, 1):
        shared = None
        if step.shared_step_id:
            shared = db.get(SharedStep, step.shared_step_id)
            if not shared or shared.project_id != project_id:
                raise HTTPException(422, "Reusable steps must belong to this project")
        source = shared or step
        if not source.action.strip():
            raise HTTPException(422, f"Step {number} needs an action")
        rows.append(
            TestCaseStep(
                step_number=number,
                action=source.action,
                test_data=source.test_data,
                expected_result=source.expected_result,
                shared_step_id=shared.id if shared else None,
            )
        )
    return rows


def covered_criteria(db, story, ids):
    if not ids:
        return []
    criteria = db.scalars(
        select(AcceptanceCriterion).where(AcceptanceCriterion.id.in_(ids))
    ).all()
    if len(criteria) != len(set(ids)) or any(c.issue_id != story.id for c in criteria):
        raise HTTPException(
            422, "Covered acceptance criteria must belong to the linked story"
        )
    return list(criteria)


def save(db, actor, data, id=None):
    story = issue_access(db, data.issue_id, actor)
    if story.project_id != data.project_id or story.issue_type != "STORY":
        raise HTTPException(
            422, "Test cases must link to a user story in the same project"
        )
    project = project_access(db, data.project_id, actor)
    # The result comes from test runs, never from the editor.
    values = data.model_dump(exclude={"steps", "criterion_ids", "status"})
    steps = build_steps(db, project.id, data.steps)
    criteria = covered_criteria(db, story, data.criterion_ids)
    if id:
        item = child_access(db, TestCase, id, actor)
        if item.project_id != data.project_id or item.issue_id != data.issue_id:
            raise HTTPException(422, "A saved test case cannot change its linked story")
        for k, v in values.items():
            setattr(item, k, v)
        item.steps.clear()
        db.flush()
    else:
        counter = db.scalar(
            update(Project)
            .where(Project.id == project.id)
            .values(test_counter=Project.test_counter + 1)
            .returning(Project.test_counter)
        )
        item = TestCase(**values, test_case_key=f"TC-{counter:03}", created_by=actor.id)
        db.add(item)
    item.steps = steps
    item.criteria = criteria
    record(
        db,
        actor,
        project.id,
        story.id,
        "updated test case" if id else "added test case",
        new=item.test_case_key,
    )
    db.commit()
    return item


def status(db, actor, id, value):
    """A lead's manual override of the result that test runs normally set."""
    item = child_access(db, TestCase, id, actor)
    require_lead(db, actor, db.get(Project, item.project_id))
    record(
        db,
        actor,
        item.project_id,
        item.issue_id,
        "changed test status",
        item.test_case_key,
        item.status,
        value,
    )
    item.status = value
    db.commit()
    return item
