from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import UserOut


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=20000)


class CommentOut(CommentIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    issue_id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    user: UserOut


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    issue_id: int | None
    user_id: int
    action: str
    field_name: str | None
    old_value: str | None
    new_value: str | None
    created_at: datetime
    user: UserOut
