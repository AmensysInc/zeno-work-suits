from typing import Annotated
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.config import settings
from app.models import User

DB = Annotated[Session, Depends(get_db)]
bearer = HTTPBearer(auto_error=False)


def current_user(
    db: DB, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
):
    try:
        if not credentials:
            raise ValueError()
        payload = jwt.decode(
            credentials.credentials, settings.jwt_secret, algorithms=["HS256"]
        )
        user = db.get(User, int(payload["sub"]))
        # A disabled account loses access immediately, even with a still-valid token.
        if not user or not user.is_active:
            raise ValueError()
        return user
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(
            401, "Please sign in again", headers={"WWW-Authenticate": "Bearer"}
        )


Actor = Annotated[User, Depends(current_user)]


def admin_user(actor: Actor):
    if not actor.is_admin:
        raise HTTPException(403, "Administrators only")
    return actor


Admin = Annotated[User, Depends(admin_user)]
