from fastapi import APIRouter, Response
from sqlalchemy import select
from app.api.deps import DB, Actor
from app.models import Comment, ActivityLog
from app.schemas.comment import CommentIn, CommentOut, ActivityOut
from app.services.access import issue_access
from app.services import comments

router = APIRouter(tags=["Comments and activity"])


@router.get("/issues/{issue_id}/comments", response_model=list[CommentOut])
def index(issue_id: int, db: DB, actor: Actor):
    issue_access(db, issue_id, actor)
    return db.scalars(
        select(Comment).where(Comment.issue_id == issue_id).order_by(Comment.created_at)
    ).all()


@router.post("/issues/{issue_id}/comments", response_model=CommentOut, status_code=201)
def create(issue_id: int, data: CommentIn, db: DB, actor: Actor):
    return comments.create(db, actor, issue_id, data)


@router.put("/comments/{id}", response_model=CommentOut)
def edit(id: int, data: CommentIn, db: DB, actor: Actor):
    return comments.edit(db, actor, id, data)


@router.delete("/comments/{id}", status_code=204)
def delete(id: int, db: DB, actor: Actor):
    db.delete(comments.owned(db, id, actor))
    db.commit()
    return Response(status_code=204)


@router.get("/issues/{issue_id}/activity", response_model=list[ActivityOut])
def activity(issue_id: int, db: DB, actor: Actor):
    issue_access(db, issue_id, actor)
    return db.scalars(
        select(ActivityLog)
        .where(ActivityLog.issue_id == issue_id)
        .order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc())
    ).all()
