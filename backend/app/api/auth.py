from fastapi import APIRouter, Request
from app.api.deps import DB, Actor
from app.schemas.auth import ChangePassword, Login, PasswordChanged, UserOut, Token
from app.services import auth

# There is no public sign-up: administrators create accounts (see app/api/admin.py).
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
def login(data: Login, db: DB, request: Request):
    return auth.login(db, data, request.client.host if request.client else "")


@router.get("/me", response_model=UserOut)
def me(actor: Actor):
    return actor


@router.post("/change-password", response_model=PasswordChanged)
def change_password(data: ChangePassword, db: DB, actor: Actor):
    return auth.change_password(db, actor, data)


@router.get("/users", response_model=list[UserOut])
def users(db: DB, actor: Actor):
    return auth.list_users(db, actor)
