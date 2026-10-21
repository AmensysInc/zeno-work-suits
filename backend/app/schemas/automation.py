from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import UserOut
from app.schemas.project import ProjectOut


Trigger = Literal["STATUS_CHANGED"]
AutomationStatus = Literal[
    "BACKLOG", "TODO", "IN_PROGRESS", "CODE_REVIEW", "TESTING", "DONE"
]
AutomationAction = Literal["NOTIFY_REPORTER", "NOTIFY_ASSIGNEE", "CREATE_BUG"]


class AutomationRuleIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    project_id: int | None = None
    trigger: Trigger = "STATUS_CHANGED"
    to_status: AutomationStatus = "IN_PROGRESS"
    action: AutomationAction = "NOTIFY_REPORTER"
    enabled: bool = True


class AutomationRuleOut(AutomationRuleIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime
    owner: UserOut
    project: ProjectOut | None
