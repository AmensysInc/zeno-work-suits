from datetime import date
from pydantic import BaseModel


class ReportUser(BaseModel):
    id: int
    first_name: str
    last_name: str


class Count(BaseModel):
    key: str
    count: int


class Summary(BaseModel):
    total_issues: int
    open_issues: int
    done_issues: int
    total_points: int
    done_points: int
    open_bugs: int
    average_velocity: float | None
    average_lead_time_days: float | None


class Velocity(BaseModel):
    sprint_id: int
    name: str
    status: str
    committed_points: int
    completed_points: int
    committed_issues: int
    completed_issues: int


class BurndownDay(BaseModel):
    date: date
    remaining: int | None
    ideal: float


class Burndown(BaseModel):
    sprint_id: int
    name: str
    total_points: int
    days: list[BurndownDay]


class Workload(BaseModel):
    user: ReportUser | None
    open_issues: int
    open_points: int
    in_progress: int
    done_issues: int


class Week(BaseModel):
    week: date
    created: int
    resolved: int


class ProjectReport(BaseModel):
    summary: Summary
    by_status: list[Count]
    by_type: list[Count]
    by_priority: list[Count]
    velocity: list[Velocity]
    burndown: Burndown | None
    workload: list[Workload]
    created_vs_resolved: list[Week]
