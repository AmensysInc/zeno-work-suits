from datetime import date
from pydantic import BaseModel


class TraceUser(BaseModel):
    id: int
    first_name: str
    last_name: str


class TraceCriterion(BaseModel):
    id: int
    description: str
    completed: bool
    test_case_ids: list[int]


class TraceExecution(BaseModel):
    id: int
    status: str
    executed_on: date
    tester: TraceUser


class TraceTest(BaseModel):
    id: int
    test_case_key: str
    title: str
    status: str
    criterion_ids: list[int]
    last_execution: TraceExecution | None


class TraceIssue(BaseModel):
    id: int
    issue_key: str
    summary: str
    status: str
    priority: str
    related_test_case_id: int | None = None
    related_execution_id: int | None = None


class TraceStory(BaseModel):
    id: int
    issue_key: str
    summary: str
    status: str
    priority: str
    story_points: int
    epic_id: int | None
    sprint_id: int | None
    assignee: TraceUser | None
    criteria: list[TraceCriterion]
    subtasks: list[TraceIssue]
    test_cases: list[TraceTest]
    bugs: list[TraceIssue]


class Traceability(BaseModel):
    epics: list[TraceIssue]
    stories: list[TraceStory]
