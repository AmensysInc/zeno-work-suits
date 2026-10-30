from typing import Literal
from pydantic import BaseModel, Field, field_validator, model_validator
from app.schemas.github import BRANCH, git_branch
from app.schemas.issue import Priority

OutputType = Literal["USER_STORIES", "TEST_CASES", "BOTH"]
CoverageType = Literal["POSITIVE", "NEGATIVE", "BOUNDARY", "VALIDATION"]
# Where the code came from: a folder of the default branch, or the changes of a
# branch, pull request or single commit.
SourceKind = Literal["DEFAULT", "BRANCH", "PULL", "COMMIT"]


class GeneratorStatusOut(BaseModel):
    github_configured: bool
    openai_configured: bool


class ModuleOut(BaseModel):
    path: str
    file_count: int


class PullModuleOut(BaseModel):
    module_path: str
    changed_files: int
    matched_files: int


class GenerateIn(BaseModel):
    project_id: int
    # Which linked repository to read ("owner/name"); the project's first when blank.
    repository: str = Field(default="", max_length=200, pattern=r"^$|^[\w.-]+/[\w.-]+$")
    module_path: str = ""
    # At most one of branch, pull_number and commit. None of them reads the
    # module from the default branch; each of them reads only what it changed.
    branch: str = Field(default="", max_length=200, pattern=r"^$|" + BRANCH)
    pull_number: int | None = Field(default=None, ge=1)
    commit: str = Field(default="", pattern=r"^$|^[0-9a-fA-F]{7,40}$")
    output_type: OutputType = "BOTH"
    coverage: list[CoverageType] = Field(default_factory=lambda: ["POSITIVE"])

    @field_validator("branch")
    @classmethod
    def _branch(cls, value):
        return git_branch(value) if value else value

    @model_validator(mode="after")
    def _one_source(self):
        if sum(map(bool, (self.branch, self.pull_number, self.commit))) > 1:
            raise ValueError("Choose a branch, a pull request or a commit, not several")
        return self


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
    # Indexes into the story's acceptance criteria that this test proves.
    criteria: list[int] = Field(default_factory=list, max_length=12)


class GeneratedStory(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str = ""
    priority: Priority = "MEDIUM"
    story_points: int = Field(default=3, ge=0, le=100)
    acceptance_criteria: list[str] = Field(default_factory=list, max_length=12)
    test_cases: list[GeneratedTestCase] = Field(default_factory=list, max_length=12)
    # Files the story was drafted from, shown for review and kept in the description.
    source_files: list[str] = Field(default_factory=list, max_length=20)
    # Set when the tests belong to a story already in the project.
    existing_issue_id: int | None = None


class GeneratedDraft(BaseModel):
    project_id: int
    repository: str
    module_path: str
    source_commit: str
    source_kind: SourceKind = "DEFAULT"
    # The branch name, pull request number or commit SHA the draft was read from.
    source_ref: str = ""
    output_type: OutputType
    coverage: list[CoverageType]
    user_stories: list[GeneratedStory] = Field(default_factory=list, max_length=40)
    notes: list[str] = Field(default_factory=list)


class SaveGeneratedIn(GeneratedDraft):
    selected_story_indexes: list[int] | None = None


class SaveGeneratedOut(BaseModel):
    issue_ids: list[int]
    updated_issue_ids: list[int] = []
    test_case_ids: list[int]


class ChangeSuggestionOut(BaseModel):
    source_commit: str
    current_commit: str
    stale_story_ids: list[int]
    stale_test_case_ids: list[int]
    message: str
