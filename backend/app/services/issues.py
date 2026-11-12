from fastapi import HTTPException
from sqlalchemy import select, update
from app.models import Issue, Project, Sprint, TestCase, TestExecution, User
from app.services import automations
from app.services.access import project_access, issue_access, require_lead
from app.services.activity import record


def _member_ids(project):
    return {u.id for u in project.members} | {project.owner_id}


def resolve_assignee_ids(values):
    """Prefer assignee_ids; fall back to legacy assignee_id when creating/updating.

    A full IssueIn dump always includes assignee_ids=[] by default — that empty
    list must not wipe a provided assignee_id. An explicit empty assignee_ids on
    update (no assignee_id in the payload) still clears assignees.
    """
    has_ids = "assignee_ids" in values and values["assignee_ids"] is not None
    has_id = "assignee_id" in values
    if has_ids:
        ids = values["assignee_ids"]
        if ids or not has_id:
            seen, out = set(), []
            for uid in ids:
                if uid not in seen:
                    seen.add(uid)
                    out.append(uid)
            return out
    if has_id:
        return [values["assignee_id"]] if values["assignee_id"] else []
    return None


def set_assignees(db, issue, project, assignee_ids):
    members = _member_ids(project)
    for uid in assignee_ids:
        if uid not in members:
            raise HTTPException(422, "Assignee must be a project member")
    people = []
    for uid in assignee_ids:
        user = db.get(User, uid)
        if not user:
            raise HTTPException(422, "Assignee must be a project member")
        people.append(user)
    issue.assignees = people
    issue.assignee_id = assignee_ids[0] if assignee_ids else None


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
    # Require a parent when creating a subtask, converting to one, or clearing it.
    # Orphaned subtasks can still be edited without touching the parent field.
    becoming_subtask = issue_type == "SUBTASK" and (
        current is None or current.issue_type != "SUBTASK"
    )
    if (
        issue_type == "SUBTASK"
        and (becoming_subtask or "parent_issue_id" in values)
        and not (
            values["parent_issue_id"]
            if "parent_issue_id" in values
            else getattr(current, "parent_issue_id", None)
        )
    ):
        raise HTTPException(422, "A subtask needs a parent")
    ids = resolve_assignee_ids(values)
    check_ids = ids if ids is not None else (
        [values["assignee_id"]] if values.get("assignee_id") else []
    )
    members = _member_ids(project)
    for uid in check_ids:
        if uid not in members:
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
    assignee_ids = resolve_assignee_ids(values) or []
    payload = {k: v for k, v in values.items() if k != "assignee_ids"}
    payload["assignee_id"] = assignee_ids[0] if assignee_ids else None
    # Mutate the same dict validate_links may update (e.g. BACKLOG → TODO in an active sprint).
    payload["assignee_ids"] = assignee_ids
    validate_links(db, project, payload)
    payload.pop("assignee_ids", None)
    counter = db.scalar(
        update(Project)
        .where(Project.id == project.id)
        .values(issue_counter=Project.issue_counter + 1)
        .returning(Project.issue_counter)
    )
    issue = Issue(**payload, issue_key=f"{project.key}-{counter}", reporter_id=actor.id)
    db.add(issue)
    db.flush()
    set_assignees(db, issue, project, assignee_ids)
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
    notifications = apply(
        db, project, issue, data.model_dump(exclude_unset=True), actor
    )
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
    from app.services import attachments as attachment_files

    issue = issue_access(db, id, actor)
    project = project_access(db, issue.project_id, actor, lock=True)
    require_lead(db, actor, project)
    project_id, issue_id = project.id, issue.id
    for subtask in db.scalars(select(Issue).where(Issue.parent_issue_id == issue.id)):
        attachment_files.purge_issue_files(subtask.id, project_id)
        db.delete(subtask)
    record(db, actor, project.id, None, "deleted issue", new=issue.issue_key)
    db.delete(issue)
    db.commit()
    attachment_files.purge_issue_files(issue_id, project_id)


def apply(db, project, issue, values, actor):
    """Applies changes to one issue; returns notifications to send after commit."""
    for key in (
        "issue_type",
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
    if "issue_type" in values and values["issue_type"] != issue.issue_type:
        new_type = values["issue_type"]
        if issue.issue_type == "EPIC" and new_type != "EPIC":
            child = db.scalar(select(Issue.id).where(Issue.epic_id == issue.id).limit(1))
            if child:
                raise HTTPException(
                    422, "Move or clear stories in this epic before changing its type"
                )
        if new_type not in ("STORY", "TASK", "BUG"):
            child = db.scalar(
                select(Issue.id).where(Issue.parent_issue_id == issue.id).limit(1)
            )
            if child:
                raise HTTPException(
                    422, "Remove or reparent subtasks before changing this issue type"
                )
        if new_type == "EPIC":
            values["epic_id"] = None
            values["parent_issue_id"] = None
            values["sprint_id"] = None
        elif new_type != "SUBTASK" and "parent_issue_id" not in values:
            values["parent_issue_id"] = None
    assignee_ids = resolve_assignee_ids(values)
    values.pop("assignee_ids", None)
    if assignee_ids is not None:
        values["assignee_id"] = assignee_ids[0] if assignee_ids else None
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
    if assignee_ids is not None:
        before = [u.id for u in issue.assignees]
        if before != assignee_ids:
            set_assignees(db, issue, project, assignee_ids)
            record(
                db,
                actor,
                project.id,
                issue.id,
                "changed",
                "assignees",
                ",".join(map(str, before)) or None,
                ",".join(map(str, assignee_ids)) or None,
            )
    if issue.status == old_status:
        return []
    return automations.run(db, actor, project, issue)
