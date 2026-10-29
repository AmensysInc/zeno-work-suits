from functools import partial
from fastapi import HTTPException
from sqlalchemy import select, or_
from app.models import AutomationRule, Project, User
from app.services.access import is_admin, project_access, visible_projects
from app.services.activity import record
from app.services.mailer import send_issue_update


def _applies(db, rule, project):
    """A project rule applies to its project; an all-projects rule to every
    project its owner can still open."""
    if rule.project_id is not None:
        return True
    return bool(
        db.scalar(
            visible_projects(rule.owner)
            .where(Project.id == project.id)
            .with_only_columns(Project.id)
        )
    )


def run(db, actor, project, issue):
    """Runs the enabled rules for an issue that just changed status.

    Bugs are created in the same transaction; emails are returned as callables
    for the caller to send after commit.
    """
    from app.services import issues  # issues calls run(); import here to avoid a cycle

    rules = db.scalars(
        select(AutomationRule)
        .where(
            AutomationRule.enabled,
            AutomationRule.trigger == "STATUS_CHANGED",
            AutomationRule.to_status == issue.status,
            or_(
                AutomationRule.project_id == project.id,
                AutomationRule.project_id.is_(None),
            ),
        )
        .order_by(AutomationRule.id)
    ).all()
    notifications = []
    for rule in rules:
        if not rule.owner.is_active or not _applies(db, rule, project):
            continue
        if rule.action == "CREATE_BUG":
            bug = issues.add(
                db,
                project,
                {
                    "project_id": project.id,
                    "issue_type": "BUG",
                    "summary": f"{issue.issue_key}: {issue.summary}"[:300],
                    "description": (
                        f"Created by the automation rule “{rule.name}” when "
                        f"{issue.issue_key} moved to {issue.status.replace('_', ' ').title()}."
                    ),
                    "priority": issue.priority,
                    "related_issue_id": issue.id,
                },
                actor,
            )
            record(db, actor, project.id, issue.id, f"automation “{rule.name}” created bug", new=bug.issue_key)
            continue
        # By id: the same edit may have just changed the assignee.
        person_id = issue.assignee_id if rule.action == "NOTIFY_ASSIGNEE" else issue.reporter_id
        person = db.get(User, person_id) if person_id else None
        if not person or not person.is_active:
            continue
        record(db, actor, project.id, issue.id, f"automation “{rule.name}” notified", new=person.email)
        message = f"{issue.issue_key} moved to {issue.status.replace('_', ' ').title()}"
        notifications.append(partial(send_issue_update, person, issue, message))
    return notifications


def list_rules(db, actor):
    query = select(AutomationRule)
    if not is_admin(actor):
        visible_project_ids = visible_projects(actor).with_only_columns(Project.id)
        query = query.where(
            or_(
                AutomationRule.owner_id == actor.id,
                AutomationRule.project_id.in_(visible_project_ids),
            )
        )
    return db.scalars(
        query.order_by(AutomationRule.created_at.desc(), AutomationRule.id.desc())
    ).all()


def create(db, actor, data):
    if data.project_id:
        project_access(db, data.project_id, actor)
    rule = AutomationRule(owner_id=actor.id, **data.model_dump())
    db.add(rule)
    db.commit()
    return rule


def removable(db, id, actor):
    rule = db.get(AutomationRule, id)
    if not rule:
        raise HTTPException(404, "Automation rule not found")
    if not is_admin(actor) and rule.owner_id != actor.id:
        raise HTTPException(403, "You can only delete your own automation rules")
    return rule
