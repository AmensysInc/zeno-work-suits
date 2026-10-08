from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.issue import Priority

TestStatus = Literal["NOT_RUN", "PASSED", "FAILED", "BLOCKED", "SKIPPED"]


class StepIn(BaseModel):
    step_number: int = Field(ge=1)
    action: str = Field(min_length=1, max_length=10000)
    expected_result: str = ""


class StepOut(StepIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class TestCaseIn(BaseModel):
    project_id: int
    issue_id: int
    title: str = Field(min_length=1, max_length=300)
    test_type: Literal["FUNCTIONAL", "REGRESSION", "INTEGRATION", "UI", "API"] = (
        "FUNCTIONAL"
    )
    priority: Priority = "MEDIUM"
    preconditions: str = ""
    expected_result: str = ""
    test_data: str = ""
    status: TestStatus = "NOT_RUN"
    steps: list[StepIn] = Field(default_factory=list, max_length=100)


class TestCaseOut(TestCaseIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    test_case_key: str
    created_by: int
    created_at: datetime
    updated_at: datetime
    steps: list[StepOut]


class TestStatusIn(BaseModel):
    status: TestStatus
