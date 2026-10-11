from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import UserOut

ExecutionStatus = Literal["PASSED", "FAILED", "BLOCKED", "SKIPPED"]
StepResult = Literal["NOT_RUN", "PASSED", "FAILED", "BLOCKED"]


class ExecutionStepIn(BaseModel):
    step_number: int = Field(ge=1)
    status: StepResult = "NOT_RUN"
    actual_result: str = Field(default="", max_length=10000)


class ExecutionStepOut(ExecutionStepIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    action: str
    test_data: str
    expected_result: str


class ExecutionIn(BaseModel):
    test_case_id: int
    status: ExecutionStatus
    actual_result: str = Field(default="", max_length=20000)
    environment: str = Field(default="", max_length=100)
    tester_id: int | None = None
    executed_on: date | None = None
    # Omitted: defaults to the project's active sprint. Explicit null: no sprint.
    sprint_id: int | None = None
    steps: list[ExecutionStepIn] = Field(default_factory=list, max_length=100)


class ExecutionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    test_case_id: int
    test_case_key: str
    test_case_title: str
    issue_id: int
    sprint_id: int | None
    status: str
    actual_result: str
    environment: str
    tester_id: int
    tester: UserOut
    executed_on: date
    created_at: datetime
    steps: list[ExecutionStepOut]
