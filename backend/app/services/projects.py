from fastapi import HTTPException
from sqlalchemy import select, update as sql_update, insert
from sqlalchemy.exc import IntegrityError
from app.models import Project, User, Issue
from app.models.project import project_members
from app.schemas.project import check_schedule, DATE_FIELDS
from app.services.access import project_access


def create(db, data, actor):
    if actor.role == "EMPLOYEE":
        raise HTTPException(403, "Employees cannot create projects")
    p = Project(**data.model_dump(), owner_id=actor.id)
    db.add(p)
    try:
        db.flush()
        db.execute(
            insert(project_members).values(
                project_id=p.id, user_id=actor.id, role="LEAD"
            )
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Project key already exists")
    db.refresh(p)
    return p


def update(db, id, data, actor):
    p = project_access(db, id, actor, owner=True)
    values = data.model_dump(exclude_unset=True)
    if values.get("board_type") is None:
        values.pop("board_type", None)
    merged = {f: values.get(f, getattr(p, f)) for f in DATE_FIELDS}
    try:
        check_schedule(merged)
    except ValueError as e:
        raise HTTPException(422, str(e))
    for k, v in values.items():
        setattr(p, k, v)
    db.commit()
    return p


def add_member(db, id, data, actor):
    """Adds people to the project, or changes their project role if already on it."""
    p = project_access(db, id, actor, owner=True)
    if data.email:
        user = db.scalar(select(User).where(User.email == data.email.lower()))
        if not user:
            raise HTTPException(404, "No registered user with that email")
        users = [user]
    else:
        users = db.scalars(select(User).where(User.id.in_(data.user_ids))).all()
        if len(users) != len(set(data.user_ids)):
            raise HTTPException(404, "One or more team members no longer exist")
    current = {m.user_id for m in p.team}
    for user in users:
        if user.id in current:
            db.execute(
                sql_update(project_members)
                .where(
                    project_members.c.project_id == p.id,
                    project_members.c.user_id == user.id,
                )
                .values(role=data.role)
            )
        else:
            db.execute(
                insert(project_members).values(
                    project_id=p.id, user_id=user.id, role=data.role
                )
            )
    db.commit()
    db.refresh(p)
    return p


def remove_member(db, id, user_id, actor):
    p = project_access(db, id, actor, owner=True)
    if user_id == p.owner_id:
        raise HTTPException(422, "The project owner cannot be removed")
    user = next((u for u in p.members if u.id == user_id), None)
    if not user:
        raise HTTPException(404, "That user is not a member of this project")
    p.members.remove(user)
    # Hand their open work back to the team rather than leave stale assignees.
    for issue in db.scalars(
        select(Issue).where(
            Issue.project_id == p.id,
            Issue.assignee_id == user_id,
            Issue.status != "DONE",
        )
    ):
        issue.assignee_id = None
    db.commit()
    db.refresh(p)
    return p
