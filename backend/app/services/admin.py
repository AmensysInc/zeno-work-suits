from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.models import User
from app.core.security import hash_password
from app.services.auth import temporary_password
from app.services.mailer import send_login_details


def list_users(db):
    return db.scalars(select(User).order_by(User.is_active.desc(), User.first_name, User.last_name)).all()


def create_user(db, data):
    temp = temporary_password()
    user = User(
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        email=data.email.lower(),
        password_hash=hash_password(temp),
        role=data.role,
        must_change_password=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A user with that email already exists")
    sent = send_login_details(user, temp) if data.send_email else False
    return {"user": user, "temporary_password": temp, "email_sent": sent}


def _get(db, user_id):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return user


def update_user(db, user_id, data, admin):
    user = _get(db, user_id)
    changes = data.model_dump(exclude_unset=True)
    demoted = changes.get("role") not in (None, "ADMIN")
    if user.id == admin.id and (demoted or changes.get("is_active") is False):
        raise HTTPException(400, "You can't remove your own admin access or disable your own account")
    if demoted or changes.get("is_active") is False:
        # Never leave the application without an active administrator.
        others = db.scalar(
            select(User.id)
            .where(User.role == "ADMIN", User.is_active, User.id != user.id)
            .limit(1)
        )
        if user.is_admin and others is None:
            raise HTTPException(400, "At least one active administrator is required")
    for key, value in changes.items():
        if value is not None:
            setattr(user, key, value.strip() if isinstance(value, str) else value)
    db.commit()
    return user


def reset_password(db, user_id, send_email):
    user = _get(db, user_id)
    temp = temporary_password()
    user.password_hash = hash_password(temp)
    user.must_change_password = True
    db.commit()
    sent = send_login_details(user, temp, reset=True) if send_email else False
    return {"user": user, "temporary_password": temp, "email_sent": sent}
