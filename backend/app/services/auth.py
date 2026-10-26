import secrets
import string
from fastapi import HTTPException
from sqlalchemy import select
from app.models import User
from app.models.base import now
from app.core.security import hash_password, verify_password, create_token


def temporary_password() -> str:
    """12 characters, easy to read aloud (no 0/O/1/l/I)."""
    alphabet = "".join(c for c in string.ascii_letters + string.digits if c not in "0O1lI")
    return "".join(secrets.choice(alphabet) for _ in range(12))


def login(db, data):
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(403, "Your account is disabled. Contact your administrator.")
    user.last_login_at = now()
    db.commit()
    return {"access_token": create_token(user.id)}


def change_password(db, actor, data):
    if not verify_password(data.current_password, actor.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    if data.new_password == data.current_password:
        raise HTTPException(400, "Choose a password different from the current one")
    actor.password_hash = hash_password(data.new_password)
    actor.must_change_password = False
    db.commit()
    return actor


def list_users(db, actor):
    if actor.role not in ("ADMIN", "MANAGER"):
        raise HTTPException(403, "Only an admin or a manager can view people")
    return db.scalars(
        select(User)
        .where(User.is_active)
        .order_by(User.first_name, User.last_name, User.id)
    ).all()
