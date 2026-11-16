from fastapi import APIRouter, HTTPException, Response
from app.api.deps import DB, Actor
from app.schemas.notification import MarkRead, NotificationList
from app.services import notifications

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=NotificationList)
def index(db: DB, actor: Actor, limit: int = notifications.PAGE_SIZE):
    return notifications.listing(db, actor, limit)


@router.post("/read", status_code=204)
def read(data: MarkRead, db: DB, actor: Actor):
    if not data.all and data.ids is None:
        raise HTTPException(422, "Choose notifications to mark as read")
    notifications.mark_read(db, actor, None if data.all else data.ids)
    return Response(status_code=204)
