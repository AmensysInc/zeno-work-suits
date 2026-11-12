from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.auth import UserOut


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    issue_id: int
    uploader_id: int
    filename: str
    content_type: str
    size_bytes: int
    created_at: datetime
    uploader: UserOut
