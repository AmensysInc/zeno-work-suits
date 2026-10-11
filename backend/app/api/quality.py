from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.api.deps import DB, Actor
from app.models import Issue, AcceptanceCriterion, TestCase, TestExecution
from app.schemas.quality import Traceability
from app.services.access import project_access

router = APIRouter(tags=["Quality"])


def user(u):
    return u and {"id": u.id, "first_name": u.first_name, "last_name": u.last_name}


def brief(i):
    return {
        "id": i.id,
        "issue_key": i.issue_key,
        "summary": i.summary,
        "status": i.status,
        "priority": i.priority,
        "related_test_case_id": i.related_test_case_id,
        "related_execution_id": i.related_execution_id,
    }


def last_run(test):
    run = test.last_execution
    return run and {
        "id": run.id,
        "status": run.status,
        "executed_on": run.executed_on,
        "tester": user(run.tester),
    }


@router.get("/projects/{project_id}/traceability", response_model=Traceability)
def traceability(project_id: int, db: DB, actor: Actor):
    """Requirement -> development -> testing -> defects, one row per user story."""
    project_access(db, project_id, actor)
    issues = db.scalars(
        select(Issue)
        .where(Issue.project_id == project_id)
        .options(selectinload(Issue.assignee))
        .order_by(Issue.order_index, Issue.id)
    ).all()
    stories = [i for i in issues if i.issue_type == "STORY"]
    criteria = db.scalars(
        select(AcceptanceCriterion)
        .where(AcceptanceCriterion.issue_id.in_([s.id for s in stories]))
        .order_by(AcceptanceCriterion.order_index, AcceptanceCriterion.id)
    ).all()
    tests = db.scalars(
        select(TestCase)
        .where(TestCase.project_id == project_id)
        .options(
            selectinload(TestCase.criteria),
            selectinload(TestCase.executions).selectinload(TestExecution.tester),
        )
        .order_by(TestCase.id)
    ).all()
    rows = []
    for story in stories:
        story_tests = [t for t in tests if t.issue_id == story.id]
        rows.append(
            {
                "id": story.id,
                "issue_key": story.issue_key,
                "summary": story.summary,
                "status": story.status,
                "priority": story.priority,
                "story_points": story.story_points,
                "epic_id": story.epic_id,
                "sprint_id": story.sprint_id,
                "assignee": user(story.assignee),
                "criteria": [
                    {
                        "id": c.id,
                        "description": c.description,
                        "completed": c.completed,
                        "test_case_ids": [
                            t.id for t in story_tests if c.id in t.criterion_ids
                        ],
                    }
                    for c in criteria
                    if c.issue_id == story.id
                ],
                "subtasks": [brief(i) for i in issues if i.parent_issue_id == story.id],
                "test_cases": [
                    {
                        "id": t.id,
                        "test_case_key": t.test_case_key,
                        "title": t.title,
                        "status": t.status,
                        "criterion_ids": t.criterion_ids,
                        "last_execution": last_run(t),
                    }
                    for t in story_tests
                ],
                "bugs": [
                    brief(i)
                    for i in issues
                    if i.issue_type == "BUG" and i.related_issue_id == story.id
                ],
            }
        )
    return {
        "epics": [brief(i) for i in issues if i.issue_type == "EPIC"],
        "stories": rows,
    }
