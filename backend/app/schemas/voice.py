from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

LANGUAGE = r"^[a-z]{2,3}$"


class VoiceSessionOut(BaseModel):
    api_key: str
    expires_at: str
    websocket_url: str
    model: str


class TranscriptIn(BaseModel):
    title: str = Field(default="", max_length=200)
    text: str = Field(min_length=1, max_length=500_000)
    languages: list[str] = Field(default_factory=list, max_length=20)
    duration_seconds: int = Field(default=0, ge=0, le=24 * 3600)
    project_id: int | None = None


class TranscriptUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=500_000)


class TranscriptProject(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    key: str
    name: str


class TranscriptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    text: str
    languages: list[str]
    duration_seconds: int
    project: TranscriptProject | None
    created_at: datetime
    updated_at: datetime
