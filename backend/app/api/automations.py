from fastapi import APIRouter, Response
from app.api.deps import DB, Actor
from app.schemas.automation import AutomationRuleIn, AutomationRuleOut
from app.services import automations

router = APIRouter(prefix="/automations", tags=["Automations"])


@router.get("", response_model=list[AutomationRuleOut])
def index(db: DB, actor: Actor):
    return automations.list_rules(db, actor)


@router.post("", response_model=AutomationRuleOut, status_code=201)
def create(data: AutomationRuleIn, db: DB, actor: Actor):
    return automations.create(db, actor, data)


@router.delete("/{id}", status_code=204)
def delete(id: int, db: DB, actor: Actor):
    db.delete(automations.removable(db, id, actor))
    db.commit()
    return Response(status_code=204)
