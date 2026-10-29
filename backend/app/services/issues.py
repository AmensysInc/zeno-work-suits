from fastapi import HTTPException
from sqlalchemy import select, update
from app.models import Issue, Project, Sprint, TestCase, TestExecution
from app.services import automations
from app.services.access import project_access, issue_access, require_lead
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
    # Checked when a subtask is created or its parent is cleared, so a subtask
    # orphaned before deletes took subtasks along can still be worked on.
    if (
        issue_type == "SUBTASK"
        and (current is None or "parent_issue_id" in values)
        and not values.get("parent_issue_id")
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
    if values.get("related_execution_id"):
        run = db.get(TestExecution, values["related_execution_id"])
        if (
            not run
            or run.project_id != project.id
            or run.test_case_id != values.get("related_test_case_id")
        ):
            raise HTTPException(422, "Bug test run and test case links must match")
    start = values.get("start_date", getattr(current, "start_date", None))
    due = values.get("due_date", getattr(current, "due_date", None))
    if start and due and due < start:
        raise HTTPException(422, "Due date must be on or after start date")


def add(db, project, values, actor):
    """Creates an issue in the open transaction; the caller commits."""
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
    return issue


def create(db, data, actor):
    project = project_access(db, data.project_id, actor, lock=True)
    issue = add(db, project, data.model_dump(), actor)
    db.commit()
    return issue


def _notify(notifications):
    # Sent after commit, so an email never announces a change that rolled back.
    for send in notifications:
        send()


def edit(db, id, data, actor):
    issue = issue_access(db, id, actor)
    project = project_access(db, issue.project_id, actor, lock=True)
    db.refresh(issue)
    notifications = apply(db, project, issue, data.model_dump(exclude_unset=True), actor)
    db.commit()
    _notify(notifications)
    return issue


def bulk_edit(db, ids, data, actor):
    """Apply the same change to several issues; all succeed or none do."""
    values = data.model_dump(exclude_unset=True)
    changed = []
    notifications = []
    for id in dict.fromkeys(ids):
        issue = issue_access(db, id, actor)
        project = project_access(db, issue.project_id, actor, lock=True)
        db.refresh(issue)
        notifications += apply(db, project, issue, dict(values), actor)
        changed.append(issue)
    db.commit()
    _notify(notifications)
    return changed


def delete(db, id, actor):
    """Deletes an issue with its subtasks; its test cases and runs go with it."""
    issue = issue_access(db, id, actor)
    project = project_access(db, issue.project_id, actor, lock=True)
    require_lead(db, actor, project)
    for subtask in db.scalars(select(Issue).where(Issue.parent_issue_id == issue.id)):
        db.delete(subtask)
    record(db, actor, project.id, None, "deleted issue", new=issue.issue_key)
    db.delete(issue)
    db.commit()


def apply(db, project, issue, values, actor):
    """Applies changes to one issue; returns notifications to send after commit."""
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
    # Work taken out of a sprint goes back to the backlog unless it has started.
    if (
        "sprint_id" in values
        and values["sprint_id"] is None
        and issue.sprint_id is not None
        and "status" not in values
        and issue.status == "TODO"
    ):
        values["status"] = "BACKLOG"
    old_status = issue.status
    for key, value in values.items():
        old = getattr(issue, key)
        if old != value:
            record(db, actor, project.id, issue.id, "changed", key, old, value)
            setattr(issue, key, value)
    if issue.status == old_status:
        return []
    return automations.run(db, actor, project, issue)
