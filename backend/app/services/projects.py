from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.models import Project, User
from app.services.access import project_access


def create(db, data, actor):
    p = Project(**data.model_dump(), owner_id=actor.id, members=[actor])
    db.add(p)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Project key already exists")
    return p


def update(db, id, data, actor):
    p = project_access(db, id, actor, owner=True)
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    db.commit()
    return p


def add_member(db, id, email, actor):
    p = project_access(db, id, actor, owner=True)
    user = db.scalar(select(User).where(User.email == email.lower()))
    if not user:
        raise HTTPException(404, "No registered user with that email")
    if user not in p.members:
        p.members.append(user)
    db.commit()
    return p
