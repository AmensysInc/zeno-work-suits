from typing import Literal
from fastapi import APIRouter
from app.api.deps import DB, Actor
from app.core.config import settings
from app.schemas.github import (
    RepoOut,
    LinkIn,
    BranchesOut,
    BranchIn,
    BranchOut,
    PullOut,
    PullIn,
    MergeIn,
    MergeOut,
    StatusOut,
)
from app.schemas.project import ProjectOut
from app.services import github

router = APIRouter(prefix="/github", tags=["GitHub"])


@router.get("/status", response_model=StatusOut)
def status(actor: Actor):
    return {"configured": bool(settings.github_token)}


@router.get("/repos", response_model=list[RepoOut])
def repos(db: DB, actor: Actor):
    return github.list_repos(db, actor)


@router.put("/projects/{project_id}/repository", response_model=ProjectOut)
def link(project_id: int, data: LinkIn, db: DB, actor: Actor):
    return github.link(db, project_id, data.full_name, actor)


@router.delete("/projects/{project_id}/repository", response_model=ProjectOut)
def unlink(project_id: int, db: DB, actor: Actor):
    return github.unlink(db, project_id, actor)


@router.get("/projects/{project_id}/branches", response_model=BranchesOut)
def branches(project_id: int, db: DB, actor: Actor):
    return github.branches(db, project_id, actor)


@router.post(
    "/projects/{project_id}/branches", response_model=BranchOut, status_code=201
)
def create_branch(project_id: int, data: BranchIn, db: DB, actor: Actor):
    return github.create_branch(db, project_id, data, actor)


@router.get("/projects/{project_id}/pulls", response_model=list[PullOut])
def pulls(
    project_id: int,
    db: DB,
    actor: Actor,
    state: Literal["open", "closed", "all"] = "open",
):
    return github.pulls(db, project_id, state, actor)


@router.post("/projects/{project_id}/pulls", response_model=PullOut, status_code=201)
def create_pull(project_id: int, data: PullIn, db: DB, actor: Actor):
    return github.create_pull(db, project_id, data, actor)


@router.put("/projects/{project_id}/pulls/{number}/merge", response_model=MergeOut)
def merge(project_id: int, number: int, data: MergeIn, db: DB, actor: Actor):
    return github.merge(db, project_id, number, data, actor)
