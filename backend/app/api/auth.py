from fastapi import APIRouter
from app.api.deps import DB, Actor
from app.schemas.auth import ChangePassword, Login, UserOut, Token
from app.services import auth

# There is no public sign-up: administrators create accounts (see app/api/admin.py).
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
def login(data: Login, db: DB):
    return auth.login(db, data)


@router.get("/me", response_model=UserOut)
def me(actor: Actor):
    return actor


@router.post("/change-password", response_model=UserOut)
def change_password(data: ChangePassword, db: DB, actor: Actor):
    return auth.change_password(db, actor, data)
