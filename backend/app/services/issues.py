from fastapi import HTTPException
from sqlalchemy import select, update
from app.models import Issue, Project, Sprint, TestCase
from app.services.access import project_access, issue_access
from app.services.activity import record


def validate_links(db, project, values, current=None):
    issue_type = values.get("issue_type", current.issue_type if current else None)
    for field in ("epic_id", "parent_issue_id", "related_issue_id"):
        target = values.get(field, getattr(current, field, None))
        if target is None:
            continue
        other = db.get(Issue, target)
        if not other or other.project_id != project.id:
            raise HTTPException(422, "Linked issues must belong to this project")
        if current and other.id == current.id:
            raise HTTPException(422, "An issue cannot link to itself")
        if field == "epic_id" and (other.issue_type != "EPIC" or issue_type == "EPIC"):
            raise HTTPException(422, "Choose an epic for a non-epic issue")
        if field == "parent_issue_id":
            if issue_type != "SUBTASK" or other.issue_type not in (
                "STORY",
                "TASK",
                "BUG",
            ):
                raise HTTPException(422, "Subtasks require a story, task or bug parent")
    if issue_type == "SUBTASK" and not values.get(
        "parent_issue_id", getattr(current, "parent_issue_id", None)
    ):
        raise HTTPException(422, "A subtask needs a parent")
    if values.get("assignee_id") and values["assignee_id"] not in {
        u.id for u in project.members
    } | {project.owner_id}:
        raise HTTPException(422, "Assignee must be a project member")
    if values.get("sprint_id"):
        sprint = db.get(Sprint, values["sprint_id"])
        if (
            not sprint
            or sprint.project_id != project.id
            or sprint.status == "COMPLETED"
        ):
            raise HTTPException(422, "Choose an open sprint in this project")
        if issue_type == "EPIC":
            raise HTTPException(422, "Epics cannot be assigned to a sprint")
        if (
            sprint.status == "ACTIVE"
            and values.get("status", getattr(current, "status", "BACKLOG")) == "BACKLOG"
        ):
            values["status"] = "TODO"
    if values.get("related_test_case_id"):
        tc = db.get(TestCase, values["related_test_case_id"])
        if (
            issue_type != "BUG"
            or not tc
            or tc.project_id != project.id
            or tc.issue_id != values.get("related_issue_id")
        ):
            raise HTTPException(422, "Bug test and story links must match")
    start = values.get("start_date", getattr(current, "start_date", None))
    due = values.get("due_date", getattr(current, "due_date", None))
    if start and due and due < start:
        raise HTTPException(422, "Due date must be on or after start date")


def create(db, data, actor):
    project = project_access(db, data.project_id, actor, lock=True)
    values = data.model_dump()
    validate_links(db, project, values)
    counter = db.scalar(
        update(Project)
        .where(Project.id == project.id)
        .values(issue_counter=Project.issue_counter + 1)
        .returning(Project.issue_counter)
    )
    issue = Issue(**values, issue_key=f"{project.key}-{counter}", reporter_id=actor.id)
    db.add(issue)
    db.flush()
    record(db, actor, project.id, issue.id, "created issue")
    db.commit()
    return issue


def edit(db, id, data, actor):
    issue = issue_access(db, id, actor)
    project = project_access(db, issue.project_id, actor, lock=True)
    db.refresh(issue)
    values = data.model_dump(exclude_unset=True)
    for key in (
        "summary",
        "description",
        "status",
        "priority",
        "story_points",
        "order_index",
        "labels",
    ):
        if key in values and values[key] is None:
            raise HTTPException(422, f"{key} cannot be null")
    validate_links(db, project, values, issue)
    for key, value in values.items():
        old = getattr(issue, key)
        if old != value:
            record(db, actor, project.id, issue.id, "changed", key, old, value)
            setattr(issue, key, value)
    db.commit()
    return issue
