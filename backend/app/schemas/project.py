from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from app.schemas.auth import UserOut


BoardType = Literal["SCRUM", "KANBAN"]
ProjectRole = Literal[
    "LEAD", "DEVELOPER", "DESIGNER", "TESTER", "BUSINESS_ANALYST", "DEVOPS"
]
GITHUB_REPO = r"^(https://github\.com/[\w.-]+/[\w.-]+/?)?$"
DATE_FIELDS = ("start_date", "end_date", "code_freeze_date", "testing_date")


class Schedule(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    code_freeze_date: date | None = None
    testing_date: date | None = None
    github_repo: str = Field(default="", max_length=500, pattern=GITHUB_REPO)

    @field_validator(*DATE_FIELDS, mode="before")
    @classmethod
    def blank_date(cls, value):
        return value or None

    @field_validator("github_repo", mode="before")
    @classmethod
    def trim_repo(cls, value):
        return (value or "").strip()


def check_schedule(values):
    """Raise ValueError when the dates in a project schedule do not fit together."""
    start, end = values.get("start_date"), values.get("end_date")
    if start and end and end < start:
        raise ValueError("End date must be on or after the start date")
    for field, name in (
        ("code_freeze_date", "Code freeze"),
        ("testing_date", "Testing"),
    ):
        day = values.get(field)
        if day and start and day < start:
            raise ValueError(f"{name} date must be on or after the start date")
        if day and end and day > end:
            raise ValueError(f"{name} date must be on or before the end date")


class ProjectIn(Schedule):
    key: str = Field(pattern=r"^[A-Z][A-Z0-9]{1,9}$")
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    board_type: BoardType = "SCRUM"

    @model_validator(mode="after")
    def dates(self):
        check_schedule(self.model_dump())
        return self


class ProjectUpdate(Schedule):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    status: Literal["ACTIVE", "ARCHIVED"] = "ACTIVE"
    board_type: BoardType | None = None


class TeamMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user: UserOut
    role: str


class RepositoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    full_name: str
    html_url: str


class ProjectOut(ProjectIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    owner_id: int
    status: str
    # The first linked repository; `repositories` lists them all.
    github_repo: str
    repositories: list[RepositoryOut] = []
    created_at: datetime
    updated_at: datetime
    members: list[UserOut]
    team: list[TeamMemberOut]


class MemberIn(BaseModel):
    """Add people by email (one) or by id (several), all with the same project role."""

    email: str | None = None
    user_ids: list[int] = Field(default_factory=list, max_length=100)
    role: ProjectRole = "DEVELOPER"

    @model_validator(mode="after")
    def someone(self):
        if not self.email and not self.user_ids:
            raise ValueError("Choose at least one team member")
        return self
