from fastapi import APIRouter, Response
from sqlalchemy import select
from app.api.deps import DB, Actor
from app.models import ChatMessage
from app.schemas.chat import ChatMessageIn, ChatMessageOut
from app.services.access import project_access
from app.services import chat

router = APIRouter(tags=["Project chat"])


@router.get("/projects/{project_id}/chat", response_model=list[ChatMessageOut])
def index(project_id: int, db: DB, actor: Actor):
    project_access(db, project_id, actor)
    return db.scalars(
        select(ChatMessage)
        .where(ChatMessage.project_id == project_id)
        .order_by(ChatMessage.created_at, ChatMessage.id)
    ).all()


@router.post(
    "/projects/{project_id}/chat", response_model=ChatMessageOut, status_code=201
)
def create(project_id: int, data: ChatMessageIn, db: DB, actor: Actor):
    return chat.create(db, actor, project_id, data)


@router.put("/chat/{id}", response_model=ChatMessageOut)
def edit(id: int, data: ChatMessageIn, db: DB, actor: Actor):
    return chat.edit(db, actor, id, data)


@router.delete("/chat/{id}", status_code=204)
def delete(id: int, db: DB, actor: Actor):
    db.delete(chat.owned(db, id, actor))
    db.commit()
    return Response(status_code=204)
