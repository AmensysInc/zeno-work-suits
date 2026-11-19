from datetime import date, datetime, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MAX_LENGTH = timedelta(hours=12)
# A series may run at most this far past its first meeting.
MAX_SERIES_DAYS = 366
Repeat = Literal["NONE", "DAILY", "WEEKDAYS", "WEEKLY", "BIWEEKLY", "MONTHLY"]


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
    # Repeating: only read when a meeting is created. The browser's time zone
    # keeps "every week at 10:00" at 10:00 local time across daylight saving.
    repeat: Repeat = "NONE"
    repeat_until: date | None = None
    time_zone: str | None = Field(default=None, max_length=64)

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
        if self.time_zone:
            try:
                ZoneInfo(self.time_zone)
            except (ZoneInfoNotFoundError, ValueError):
                self.time_zone = None
        if self.repeat != "NONE":
            if not self.repeat_until:
                raise ValueError("Choose the date the meeting repeats until")
            first = self.starts_at.date()
            if self.repeat_until <= first:
                raise ValueError("The repeat end date must be after the first meeting")
            if (self.repeat_until - first).days > MAX_SERIES_DAYS:
                raise ValueError("A meeting can repeat for at most one year")
        return self


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)

    @field_validator("body")
    @classmethod
    def _text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Write a message")
        return value.strip()


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    meeting_id: int
    body: str
    created_at: datetime
    user: Person

    @field_validator("created_at")
    @classmethod
    def _utc(cls, value: datetime) -> datetime:
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


class TranscriptStart(BaseModel):
    """Which call is being recorded: a meeting's or a project's."""

    meeting_id: int | None = None
    project_id: int | None = None

    @model_validator(mode="after")
    def _one(self):
        if (self.meeting_id is None) == (self.project_id is None):
            raise ValueError("Choose a meeting or a project call")
        return self


class TranscriptSave(BaseModel):
    text: str = Field(default="", max_length=500_000)
    languages: list[str] = Field(default_factory=list, max_length=20)
    finished: bool = False


class TranscriptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    meeting_id: int | None
    project_id: int | None
    # RECORDING, DONE, or INTERRUPTED (the recorder's browser stopped saving).
    status: str
    text: str
    languages: list[str]
    started_at: datetime
    updated_at: datetime
    ended_at: datetime | None
    user: Person

    @field_validator("started_at", "updated_at", "ended_at")
    @classmethod
    def _utc(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


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
    series_id: str | None = None
    repeat: str | None = None
    repeat_until: date | None = None
    created_at: datetime

    @field_validator("starts_at", "ends_at", "created_at")
    @classmethod
    def _utc(cls, value: datetime) -> datetime:
        # Stored in UTC; some databases hand it back without the zone, and a
        # browser would then read it as local time.
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
