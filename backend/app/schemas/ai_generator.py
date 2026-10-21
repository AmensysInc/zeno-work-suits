from typing import Literal
from pydantic import BaseModel, Field
from app.schemas.issue import Priority

OutputType = Literal["USER_STORIES", "TEST_CASES", "BOTH"]
CoverageType = Literal["POSITIVE", "NEGATIVE", "BOUNDARY", "VALIDATION"]


class GeneratorStatusOut(BaseModel):
    github_configured: bool
    openai_configured: bool


class ModuleOut(BaseModel):
    path: str
    file_count: int


class GenerateIn(BaseModel):
    project_id: int
    module_path: str = ""
    output_type: OutputType = "BOTH"
    coverage: list[CoverageType] = Field(default_factory=lambda: ["POSITIVE"])


class GeneratedStep(BaseModel):
    action: str
    test_data: str = ""
    expected_result: str


class GeneratedTestCase(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    test_type: Literal["FUNCTIONAL", "REGRESSION", "INTEGRATION", "UI", "API"] = (
        "FUNCTIONAL"
    )
    priority: Priority = "MEDIUM"
    preconditions: str = ""
    test_data: str = ""
    expected_result: str = ""
    steps: list[GeneratedStep] = Field(default_factory=list, max_length=20)


class GeneratedStory(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str = ""
    priority: Priority = "MEDIUM"
    story_points: int = Field(default=3, ge=0, le=100)
    acceptance_criteria: list[str] = Field(default_factory=list, max_length=12)
    test_cases: list[GeneratedTestCase] = Field(default_factory=list, max_length=12)


class GeneratedDraft(BaseModel):
    project_id: int
    repository: str
    module_path: str
    source_commit: str
    output_type: OutputType
    coverage: list[CoverageType]
    user_stories: list[GeneratedStory] = Field(default_factory=list, max_length=20)
    notes: list[str] = Field(default_factory=list)


class SaveGeneratedIn(GeneratedDraft):
    selected_story_indexes: list[int] | None = None


class SaveGeneratedOut(BaseModel):
    issue_ids: list[int]
    test_case_ids: list[int]


class ChangeSuggestionOut(BaseModel):
    source_commit: str
    current_commit: str
    stale_story_ids: list[int]
    stale_test_case_ids: list[int]
    message: str
