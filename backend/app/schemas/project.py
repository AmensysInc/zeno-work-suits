from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import UserOut


class ProjectIn(BaseModel):
    key: str = Field(pattern=r"^[A-Z][A-Z0-9]{1,9}$")
    name: str = Field(min_length=1, max_length=200)
    description: str = ""


class ProjectUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    status: Literal["ACTIVE", "ARCHIVED"] = "ACTIVE"


class ProjectOut(ProjectIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    owner_id: int
    status: str
    created_at: datetime
    updated_at: datetime
    members: list[UserOut]


class MemberIn(BaseModel):
    email: str
