from typing import Annotated
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.config import settings
from app.core.security import password_version
from app.models import User

DB = Annotated[Session, Depends(get_db)]
bearer = HTTPBearer(auto_error=False)


# What someone still on an admin-issued temporary password may call.
FIRST_LOGIN_PATHS = {"/api/auth/me", "/api/auth/change-password"}


def current_user(
    request: Request,
    db: DB,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
):
    try:
        if not credentials:
            raise ValueError()
        payload = jwt.decode(
            credentials.credentials, settings.jwt_secret, algorithms=["HS256"]
        )
        user = db.get(User, int(payload["sub"]))
        # A disabled account loses access immediately, even with a still-valid
        # token; so does every token issued before a password change or reset.
        if (
            not user
            or not user.is_active
            or payload["pv"] != password_version(user.password_hash)
        ):
            raise ValueError()
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(
            401, "Please sign in again", headers={"WWW-Authenticate": "Bearer"}
        )
    if user.must_change_password and request.url.path not in FIRST_LOGIN_PATHS:
        raise HTTPException(403, "Choose a new password before continuing")
    return user


Actor = Annotated[User, Depends(current_user)]


def admin_user(actor: Actor):
    if not actor.is_admin:
        raise HTTPException(403, "Administrators only")
    return actor


Admin = Annotated[User, Depends(admin_user)]
