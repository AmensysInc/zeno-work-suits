from fastapi import HTTPException
from sqlalchemy import select, or_
from app.models import AutomationRule, Project
from app.services.access import is_admin, project_access, visible_projects


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
