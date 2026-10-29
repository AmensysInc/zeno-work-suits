import secrets
import string
from datetime import datetime, timedelta, timezone
from math import ceil
from threading import Lock
from fastapi import HTTPException
from sqlalchemy import select
from app.models import User
from app.models.base import now
from app.core.security import hash_password, verify_password, create_token


def temporary_password() -> str:
    """12 characters, easy to read aloud (no 0/O/1/l/I)."""
    alphabet = "".join(c for c in string.ascii_letters + string.digits if c not in "0O1lI")
    return "".join(secrets.choice(alphabet) for _ in range(12))


LOCKOUT = timedelta(minutes=15)
# Failed sign-ins allowed per (email, address), and per email from anywhere:
# client addresses come from forwarded headers and can be spoofed, while a low
# per-email limit alone would let anyone lock a colleague out.
MAX_FAILED_LOGINS = 5
MAX_FAILED_LOGINS_PER_EMAIL = 20
# Per process: with N workers an attacker gets at most N times the limits;
# nginx rate-limits the endpoint as well.
_failures: dict[tuple[str, str], list[datetime]] = {}
_failures_lock = Lock()


def _recent_failures(key):
    cutoff = datetime.now(timezone.utc) - LOCKOUT
    with _failures_lock:
        times = [t for t in _failures.get(key, []) if t > cutoff]
        if times:
            _failures[key] = times
        else:
            _failures.pop(key, None)
        return times


def _fail(key):
    with _failures_lock:
        _failures.setdefault(key, []).append(datetime.now(timezone.utc))


def login(db, data, address=""):
    email = data.email.lower()
    keys = ((email, address), (email, "*"))
    for key, limit in zip(keys, (MAX_FAILED_LOGINS, MAX_FAILED_LOGINS_PER_EMAIL)):
        failures = _recent_failures(key)
        if len(failures) >= limit:
            left = failures[0] + LOCKOUT - datetime.now(timezone.utc)
            wait = max(1, ceil(left.total_seconds() / 60))
            raise HTTPException(
                429,
                f"Too many failed sign-ins. Try again in {wait} minute{'s' if wait > 1 else ''}.",
            )
    user = db.scalar(select(User).where(User.email == email))
    if not user or not verify_password(data.password, user.password_hash):
        for key in keys:
            _fail(key)
        raise HTTPException(401, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(403, "Your account is disabled. Contact your administrator.")
    with _failures_lock:
        _failures.pop(keys[0], None)
    user.last_login_at = now()
    db.commit()
    return {"access_token": create_token(user)}


def change_password(db, actor, data):
    """Sets a new password; returns the person with a fresh token, since the
    change signs out every older one."""
    if not verify_password(data.current_password, actor.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    if data.new_password == data.current_password:
        raise HTTPException(400, "Choose a password different from the current one")
    actor.password_hash = hash_password(data.new_password)
    actor.must_change_password = False
    db.commit()
    actor.access_token = create_token(actor)
    return actor


def list_users(db, actor):
    if actor.role not in ("ADMIN", "MANAGER"):
        raise HTTPException(403, "Only an admin or a manager can view people")
    return db.scalars(
        select(User)
        .where(User.is_active)
        .order_by(User.first_name, User.last_name, User.id)
    ).all()
