from fastapi import APIRouter
from app.api.deps import DB, Actor
from app.schemas.auth import Login, Register, UserOut, Token, RoleIn, UserCreate
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


@router.get("/users", response_model=list[UserOut])
def users(db: DB, actor: Actor):
    return auth.list_users(db, actor)


@router.post("/users", response_model=UserOut, status_code=201)
def add_user(data: UserCreate, db: DB, actor: Actor):
    return auth.create_user(db, actor, data)


@router.patch("/users/{user_id}", response_model=UserOut)
def role(user_id: int, data: RoleIn, db: DB, actor: Actor):
    return auth.set_role(db, actor, user_id, data.role)
