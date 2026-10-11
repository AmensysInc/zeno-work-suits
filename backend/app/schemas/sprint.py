from datetime import date
from pydantic import BaseModel, ConfigDict, Field, model_validator


class SprintIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    goal: str = ""
    start_date: date | None = None
    end_date: date | None = None
    capacity: int = Field(default=30, ge=1, le=10000)

    @model_validator(mode="after")
    def dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("End date must be on or after start date")
        return self


class SprintOut(SprintIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    status: str
