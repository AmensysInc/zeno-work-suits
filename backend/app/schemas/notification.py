from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.meeting import Person


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    kind: str
    title: str
    body: str
    link: str
    read_at: datetime | None
    created_at: datetime
    actor: Person | None = None


class NotificationList(BaseModel):
    items: list[NotificationOut]
    unread: int


class MarkRead(BaseModel):
    """Either the ids to mark, or all=true for everything."""

    ids: list[int] | None = Field(default=None, max_length=500)
    all: bool = False
