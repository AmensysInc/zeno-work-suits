from fastapi import APIRouter
from app.api.deps import DB, Actor
from app.core.config import settings
from app.schemas.ai_generator import (
    ModuleOut,
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


@router.get("/status", response_model=GeneratorStatusOut)
def status(actor: Actor):
    return {
        "github_configured": bool(settings.github_token),
        "openai_configured": bool(settings.openai_api_key),
    }


@router.get("/projects/{project_id}/modules", response_model=list[ModuleOut])
def modules(project_id: int, db: DB, actor: Actor):
    return ai_generator.modules(db, actor, project_id)


@router.get(
    "/projects/{project_id}/pulls/{number}/module", response_model=PullModuleOut
)
def pull_module(project_id: int, number: int, db: DB, actor: Actor):
    return ai_generator.pull_module(db, actor, project_id, number)


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
