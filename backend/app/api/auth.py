from fastapi import APIRouter
from app.api.deps import DB, Actor
from app.schemas.auth import Login, Register, UserOut, Token
from app.services import auth

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=Token, status_code=201)
def register(data: Register, db: DB):
    return auth.register(db, data)


@router.post("/login", response_model=Token)
def login(data: Login, db: DB):
    return auth.login(db, data)


@router.get("/me", response_model=UserOut)
def me(actor: Actor):
    return actor
