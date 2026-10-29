from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def _max_72_bytes(value: str) -> str:
    if len(value.encode()) > 72:
        raise ValueError("Password must be at most 72 bytes")
    return value


class Login(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def password_bytes(cls, value):
        return _max_72_bytes(value)


class ChangePassword(BaseModel):
    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def password_bytes(cls, value):
        return _max_72_bytes(value)


Role = Literal["ADMIN", "MANAGER", "EMPLOYEE"]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    first_name: str
    last_name: str
    email: str
    role: str
    avatar_url: str | None
    is_admin: bool = False
    must_change_password: bool = False


class PasswordChanged(UserOut):
    # A new password signs out older tokens, including the one that changed it.
    access_token: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── admin ──
class AdminUserOut(UserOut):
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None


class AdminUserCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    role: Role = "EMPLOYEE"
    send_email: bool = True


class AdminUserUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=80)
    last_name: str | None = Field(default=None, min_length=1, max_length=80)
    role: Role | None = None
    is_active: bool | None = None


class ResetPasswordIn(BaseModel):
    send_email: bool = True


class IssuedLogin(BaseModel):
    user: AdminUserOut
    temporary_password: str
    email_sent: bool
