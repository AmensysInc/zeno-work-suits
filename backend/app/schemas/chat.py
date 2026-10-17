from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import UserOut


class ChatMessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class ChatMessageOut(ChatMessageIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    user: UserOut
