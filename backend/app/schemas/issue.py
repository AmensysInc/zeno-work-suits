from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import UserOut

IssueType = Literal["EPIC", "STORY", "TASK", "BUG", "SUBTASK"]
Priority = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
Status = Literal["BACKLOG", "TODO", "IN_PROGRESS", "CODE_REVIEW", "TESTING", "DONE"]


class IssueIn(BaseModel):
    project_id: int
    issue_type: IssueType = "STORY"
    summary: str = Field(min_length=1, max_length=300)
    description: str = ""
    status: Status = "BACKLOG"
    priority: Priority = "MEDIUM"
    assignee_id: int | None = None
    parent_issue_id: int | None = None
    epic_id: int | None = None
    sprint_id: int | None = None
    related_issue_id: int | None = None
    related_test_case_id: int | None = None
    story_points: int = Field(default=0, ge=0, le=1000)
    order_index: float = 0
    labels: list[str] = Field(default_factory=list, max_length=30)
    start_date: date | None = None
    due_date: date | None = None


class IssueUpdate(BaseModel):
    summary: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = None
    status: Status | None = None
    priority: Priority | None = None
    assignee_id: int | None = None
    parent_issue_id: int | None = None
    epic_id: int | None = None
    sprint_id: int | None = None
    story_points: int | None = Field(default=None, ge=0, le=1000)
    order_index: float | None = None
    labels: list[str] | None = Field(default=None, max_length=30)
    start_date: date | None = None
    due_date: date | None = None


class IssueOut(IssueIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    issue_key: str
    reporter_id: int
    created_at: datetime
    updated_at: datetime
    assignee: UserOut | None
    reporter: UserOut


class StatusIn(BaseModel):
    status: Status
