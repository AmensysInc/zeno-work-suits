from fastapi import HTTPException
from app.models import ChatMessage
from app.services.access import project_access


def create(db, actor, project_id, data):
    project_access(db, project_id, actor)
    message = ChatMessage(project_id=project_id, user_id=actor.id, body=data.body)
    db.add(message)
    db.commit()
    return message


def owned(db, id, actor):
    message = db.get(ChatMessage, id)
    if not message:
        raise HTTPException(404, "Message not found")
    project_access(db, message.project_id, actor)
    if message.user_id != actor.id:
        raise HTTPException(403, "You can only edit or delete your own messages")
    return message


def edit(db, actor, id, data):
    message = owned(db, id, actor)
    message.body = data.body
    db.commit()
    return message
