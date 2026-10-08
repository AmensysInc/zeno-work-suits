from fastapi import HTTPException
from sqlalchemy import update
from app.models import TestCase, TestCaseStep, Project
from app.services.access import project_access, issue_access, child_access
from app.services.activity import record


def save(db, actor, data, id=None):
    story = issue_access(db, data.issue_id, actor)
    if story.project_id != data.project_id or story.issue_type != "STORY":
        raise HTTPException(
            422, "Test cases must link to a user story in the same project"
        )
    project = project_access(db, data.project_id, actor)
    values = data.model_dump(exclude={"steps"})
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
    item.steps = [
        TestCaseStep(step_number=n, action=s.action, expected_result=s.expected_result)
        for n, s in enumerate(data.steps, 1)
    ]
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
    item = child_access(db, TestCase, id, actor)
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
