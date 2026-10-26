from fastapi import APIRouter
from app.api.deps import DB, Admin
from app.schemas.auth import (
    AdminUserCreate,
    AdminUserOut,
    AdminUserUpdate,
    IssuedLogin,
    ResetPasswordIn,
)
from app.services import admin
from app.services.mailer import email_configured

router = APIRouter(prefix="/admin", tags=["Administration"])


@router.get("/settings")
def settings(actor: Admin):
    return {"email_configured": email_configured()}


@router.get("/users", response_model=list[AdminUserOut])
def users(db: DB, actor: Admin):
    return admin.list_users(db)


@router.post("/users", response_model=IssuedLogin, status_code=201)
def create_user(data: AdminUserCreate, db: DB, actor: Admin):
    return admin.create_user(db, data)


@router.patch("/users/{id}", response_model=AdminUserOut)
def update_user(id: int, data: AdminUserUpdate, db: DB, actor: Admin):
    return admin.update_user(db, id, data, actor)


@router.post("/users/{id}/reset-password", response_model=IssuedLogin)
def reset_password(id: int, data: ResetPasswordIn, db: DB, actor: Admin):
    return admin.reset_password(db, id, data.send_email)
