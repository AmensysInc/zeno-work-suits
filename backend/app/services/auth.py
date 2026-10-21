from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from app.models import User
from app.models.user import ROLES
from app.core.security import hash_password, verify_password, create_token


def register(db, data):
    # The first account bootstraps the workspace. Later accounts start as employees.
    is_first = db.scalar(select(func.count()).select_from(User)) == 0
    user = User(
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        role="ADMIN" if is_first else "EMPLOYEE",
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Email already registered")
    return {"access_token": create_token(user.id)}


def login(db, data):
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    return {"access_token": create_token(user.id)}


def list_users(db, actor):
    if actor.role not in ("ADMIN", "MANAGER"):
        raise HTTPException(403, "Only an admin or a manager can view people")
    return db.scalars(
        select(User).order_by(User.first_name, User.last_name, User.id)
    ).all()


def create_user(db, actor, data):
    if actor.role != "ADMIN":
        raise HTTPException(403, "Only an admin can add people")
    user = User(
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Someone with that email already has an account")
    return user


def set_role(db, actor, user_id, role):
    if actor.role != "ADMIN":
        raise HTTPException(403, "Only an admin can change roles")
    if role not in ROLES:
        raise HTTPException(422, "Role must be admin, manager or employee")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.role == "ADMIN" and role != "ADMIN":
        admins = db.scalar(
            select(func.count()).select_from(User).where(User.role == "ADMIN")
        )
        if admins <= 1:
            raise HTTPException(422, "At least one admin is required")
    user.role = role
    db.commit()
    return user
