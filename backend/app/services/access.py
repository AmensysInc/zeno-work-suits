from fastapi import HTTPException
from sqlalchemy import select, or_
from app.models import Project, Issue, User


def visible_projects(actor):
    return select(Project).where(
        or_(Project.owner_id == actor.id, Project.members.any(User.id == actor.id))
    )


def project_access(db, project_id, actor, owner=False, lock=False):
    query = visible_projects(actor).where(Project.id == project_id)
    if lock:
        query = query.with_for_update()
    project = db.scalar(query)
    if not project:
        raise HTTPException(404, "Project not found")
    if owner and project.owner_id != actor.id:
        raise HTTPException(403, "Only the project owner can do this")
    return project


def issue_access(db, issue_id, actor):
    issue = db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(404, "Issue not found")
    project_access(db, issue.project_id, actor)
    return issue


def child_access(db, model, id, actor):
    obj = db.get(model, id)
    if not obj:
        raise HTTPException(404, "Item not found")
    if hasattr(obj, "project_id"):
        project_access(db, obj.project_id, actor)
    else:
        issue_access(db, obj.issue_id, actor)
    return obj
