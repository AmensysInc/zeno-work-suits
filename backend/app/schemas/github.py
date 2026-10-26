from typing import Literal
from pydantic import BaseModel, Field, field_validator

BRANCH = r"^[\w./-]+$"


class RepoOut(BaseModel):
    full_name: str
    html_url: str
    description: str
    private: bool
    default_branch: str
    linked_projects: list[str]


class LinkIn(BaseModel):
    full_name: str = Field(pattern=r"^[\w.-]+/[\w.-]+$", max_length=200)


class BranchOut(BaseModel):
    name: str
    sha: str
    protected: bool


class BranchesOut(BaseModel):
    repository: str
    html_url: str
    default_branch: str
    can_merge: bool
    branches: list[BranchOut]


def git_branch(value):
    value = value.strip()
    if (
        value.startswith(("/", "-", "."))
        or value.endswith(("/", ".", ".lock"))
        or ".." in value
        or "//" in value
    ):
        raise ValueError("That is not a valid branch name")
    return value


class BranchIn(BaseModel):
    name: str = Field(min_length=1, max_length=200, pattern=BRANCH)
    from_branch: str = Field(min_length=1, max_length=200, pattern=BRANCH)

    _valid = field_validator("name", "from_branch")(git_branch)


class PullOut(BaseModel):
    number: int
    title: str
    state: Literal["open", "closed", "merged"]
    draft: bool
    head: str
    base: str
    author: str
    html_url: str
    created_at: str
    updated_at: str


class CommitOut(BaseModel):
    sha: str
    message: str
    author: str
    date: str
    html_url: str


class PullIn(BaseModel):
    title: str = Field(min_length=1, max_length=256)
    head: str = Field(min_length=1, max_length=200, pattern=BRANCH)
    base: str = Field(min_length=1, max_length=200, pattern=BRANCH)
    body: str = Field(default="", max_length=65000)
    draft: bool = False


class MergeIn(BaseModel):
    method: Literal["merge", "squash", "rebase"] = "merge"


class MergeOut(BaseModel):
    merged: bool
    message: str
    sha: str


class StatusOut(BaseModel):
    configured: bool
