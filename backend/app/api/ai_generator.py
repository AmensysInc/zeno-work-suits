from fastapi import APIRouter, Query
from app.api.deps import DB, Actor
from app.core.config import settings
from app.schemas.ai_generator import (
    ModuleOut,
    ChangeNoteOut,
    ChangeNoteContentOut,
    CHANGE_NOTE,
    PullModuleOut,
    GenerateIn,
    GeneratedDraft,
    SaveGeneratedIn,
    SaveGeneratedOut,
    ChangeSuggestionOut,
    GeneratorStatusOut,
)
from app.services import ai_generator

router = APIRouter(prefix="/ai-generator", tags=["AI generator"])
# Which of the project's linked repositories to read; the first when left out.
Repo = Query(default=None, max_length=200, pattern=r"^[\w.-]+/[\w.-]+$")


@router.get("/status", response_model=GeneratorStatusOut)
def status(actor: Actor):
    return {
        "github_configured": bool(settings.github_token),
        "openai_configured": bool(settings.openai_api_key),
    }


@router.get("/projects/{project_id}/modules", response_model=list[ModuleOut])
def modules(project_id: int, db: DB, actor: Actor, repo: str | None = Repo):
    return ai_generator.modules(db, actor, project_id, repo)


@router.get("/projects/{project_id}/change-notes", response_model=list[ChangeNoteOut])
def change_notes(project_id: int, db: DB, actor: Actor, repo: str | None = Repo):
    """The Changes/ folder's notes, newest first, read with the server's token."""
    return ai_generator.change_notes(db, actor, project_id, repo)


@router.get(
    "/projects/{project_id}/change-notes/content", response_model=ChangeNoteContentOut
)
def change_note(
    project_id: int,
    db: DB,
    actor: Actor,
    path: str = Query(max_length=300, pattern=CHANGE_NOTE),
    repo: str | None = Repo,
):
    """One note's text, so people without GitHub access can read it in the app."""
    return ai_generator.change_note(db, actor, project_id, path, repo)


@router.get(
    "/projects/{project_id}/pulls/{number}/module", response_model=PullModuleOut
)
def pull_module(
    project_id: int, number: int, db: DB, actor: Actor, repo: str | None = Repo
):
    return ai_generator.pull_module(db, actor, project_id, number, repo)


@router.post("/generate", response_model=GeneratedDraft)
def generate(data: GenerateIn, db: DB, actor: Actor):
    return ai_generator.generate(db, actor, data)


@router.post("/save", response_model=SaveGeneratedOut)
def save(data: SaveGeneratedIn, db: DB, actor: Actor):
    return ai_generator.save(db, actor, data)


@router.get(
    "/projects/{project_id}/change-suggestions", response_model=ChangeSuggestionOut
)
def change_suggestions(project_id: int, db: DB, actor: Actor):
    return ai_generator.suggestions(db, actor, project_id)
