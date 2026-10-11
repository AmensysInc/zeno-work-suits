from fastapi import HTTPException
from app.models import SharedStep
from app.services.access import project_access, child_access


def save(db, actor, data, id=None):
    project_access(db, data.project_id, actor)
    if id:
        item = child_access(db, SharedStep, id, actor)
        if item.project_id != data.project_id:
            raise HTTPException(422, "A reusable step cannot move between projects")
        for key, value in data.model_dump().items():
            setattr(item, key, value)
        # Keep every test case that uses this step in sync with the library.
        for step in item.usages:
            step.action = item.action
            step.test_data = item.test_data
            step.expected_result = item.expected_result
    else:
        item = SharedStep(**data.model_dump(), created_by=actor.id)
        db.add(item)
    db.commit()
    return item
