from pydantic import BaseModel, Field, ConfigDict


class CriterionIn(BaseModel):
    description: str = Field(min_length=1, max_length=5000)
    order_index: int = Field(default=0, ge=0)
    completed: bool = False


class CriterionOut(CriterionIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    issue_id: int


class ReorderIn(BaseModel):
    issue_id: int
    ids: list[int]
