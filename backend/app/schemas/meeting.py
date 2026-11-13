from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MAX_LENGTH = timedelta(hours=12)


class Person(BaseModel):
    """A colleague as shown on the calendar: no email or account details."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    first_name: str
    last_name: str
    avatar_url: str | None = None


class MeetingProject(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    key: str
    name: str


class MeetingIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    starts_at: datetime
    ends_at: datetime
    project_id: int | None = None
    attendee_ids: list[int] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def _times(self):
        if self.starts_at.tzinfo is None or self.ends_at.tzinfo is None:
            raise ValueError("Times must include a time zone")
        if self.ends_at <= self.starts_at:
            raise ValueError("The meeting must end after it starts")
        if self.ends_at - self.starts_at > MAX_LENGTH:
            raise ValueError("A meeting can be at most 12 hours long")
        self.title = self.title.strip()
        if not self.title:
            raise ValueError("Give the meeting a title")
        return self


class MeetingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: str
    starts_at: datetime
    ends_at: datetime
    organizer: Person
    attendees: list[Person]
    project: MeetingProject | None = None
    created_at: datetime

    @field_validator("starts_at", "ends_at", "created_at")
    @classmethod
    def _utc(cls, value: datetime) -> datetime:
        # Stored in UTC; some databases hand it back without the zone, and a
        # browser would then read it as local time.
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
