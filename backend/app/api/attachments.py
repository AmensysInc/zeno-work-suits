from fastapi import APIRouter, File, Response, UploadFile
from fastapi.responses import FileResponse
from app.api.deps import DB, Actor
from app.schemas.attachment import AttachmentOut
from app.services import attachments

router = APIRouter(tags=["Attachments"])


@router.get("/issues/{issue_id}/attachments", response_model=list[AttachmentOut])
def index(issue_id: int, db: DB, actor: Actor):
    return attachments.list_for_issue(db, actor, issue_id)


@router.post(
    "/issues/{issue_id}/attachments",
    response_model=list[AttachmentOut],
    status_code=201,
)
async def upload(
    issue_id: int,
    db: DB,
    actor: Actor,
    files: list[UploadFile] = File(...),
):
    return await attachments.add_files(db, actor, issue_id, files)


@router.get("/attachments/{id}/download")
def download(id: int, db: DB, actor: Actor):
    item = attachments.get_owned(db, actor, id)
    path = attachments.absolute_path(item)
    return FileResponse(
        path,
        media_type=item.content_type,
        filename=item.filename,
    )


@router.delete("/attachments/{id}", status_code=204)
def delete(id: int, db: DB, actor: Actor):
    attachments.delete(db, actor, id)
    return Response(status_code=204)
