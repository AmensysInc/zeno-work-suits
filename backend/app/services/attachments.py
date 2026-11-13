import re
import uuid
from pathlib import Path
from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.config import settings
from app.models import IssueAttachment
from app.services.access import issue_access
from app.services.activity import record

# Common document / image types; octet-stream is allowed when the extension is known.
ALLOWED_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".bmp",
    ".svg",
    ".pdf",
    ".txt",
    ".csv",
    ".md",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".odt",
    ".ods",
    ".odp",
    ".rtf",
    ".zip",
    ".rar",
    ".7z",
    ".json",
    ".xml",
    ".yaml",
    ".yml",
}

ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/svg+xml",
    "application/pdf",
    "text/plain",
    "text/csv",
    "text/markdown",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.presentation",
    "application/rtf",
    "application/zip",
    "application/x-zip-compressed",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    "application/json",
    "application/xml",
    "text/xml",
    "application/x-yaml",
    "text/yaml",
    "application/octet-stream",
}

# The stored and served type always comes from the file extension, never from the
# uploader, so a file named "x.pdf" can't be sent back as SVG or HTML.
TYPE_BY_EXTENSION = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".md": "text/markdown",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".odt": "application/vnd.oasis.opendocument.text",
    ".ods": "application/vnd.oasis.opendocument.spreadsheet",
    ".odp": "application/vnd.oasis.opendocument.presentation",
    ".rtf": "application/rtf",
    ".zip": "application/zip",
    ".rar": "application/x-rar-compressed",
    ".7z": "application/x-7z-compressed",
    ".json": "application/json",
    ".xml": "application/xml",
    ".yaml": "application/x-yaml",
    ".yml": "application/x-yaml",
}


def content_type_for(filename: str) -> str:
    return TYPE_BY_EXTENSION.get(Path(filename).suffix.lower(), "application/octet-stream")


SAFE_NAME = re.compile(r"[^A-Za-z0-9._\-\s()]+")


def _root() -> Path:
    path = Path(settings.upload_dir)
    if not path.is_absolute():
        path = Path.cwd() / path
    path.mkdir(parents=True, exist_ok=True)
    return path


def _safe_filename(name: str) -> str:
    base = Path(name or "file").name
    cleaned = SAFE_NAME.sub("_", base).strip(" ._") or "file"
    return cleaned[:200]


def _validate(file: UploadFile, size: int):
    if size <= 0:
        raise HTTPException(422, "Empty files cannot be uploaded")
    if size > settings.max_upload_bytes:
        mb = settings.max_upload_bytes // (1024 * 1024)
        raise HTTPException(422, f"Each file must be at most {mb} MB")
    filename = _safe_filename(file.filename or "file")
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            422,
            "Unsupported file type. Use images, PDF, Office, text, or archive files.",
        )
    declared = (file.content_type or "application/octet-stream").split(";")[0].strip().lower()
    if declared not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            422,
            "Unsupported file type. Use images, PDF, Office, text, or archive files.",
        )
    return filename, content_type_for(filename)


async def add_files(db, actor, issue_id: int, files: list[UploadFile]):
    if not files:
        raise HTTPException(422, "Choose at least one file")
    if len(files) > 20:
        raise HTTPException(422, "Upload at most 20 files at a time")
    issue = issue_access(db, issue_id, actor)
    saved: list[IssueAttachment] = []
    root = _root()
    issue_dir = root / str(issue.project_id) / str(issue.id)
    issue_dir.mkdir(parents=True, exist_ok=True)
    for file in files:
        raw = await file.read()
        filename, content_type = _validate(file, len(raw))
        stored = f"{uuid.uuid4().hex}_{filename}"
        path = issue_dir / stored
        path.write_bytes(raw)
        rel = str(path.relative_to(root)).replace("\\", "/")
        attachment = IssueAttachment(
            issue_id=issue.id,
            uploader_id=actor.id,
            filename=filename,
            content_type=content_type,
            size_bytes=len(raw),
            storage_path=rel,
        )
        db.add(attachment)
        saved.append(attachment)
        record(db, actor, issue.project_id, issue.id, "uploaded", "attachment", None, filename)
    db.commit()
    ids = [item.id for item in saved]
    return db.scalars(
        select(IssueAttachment)
        .where(IssueAttachment.id.in_(ids))
        .options(selectinload(IssueAttachment.uploader))
        .order_by(IssueAttachment.created_at.desc(), IssueAttachment.id.desc())
    ).all()


def list_for_issue(db, actor, issue_id: int):
    issue_access(db, issue_id, actor)
    return db.scalars(
        select(IssueAttachment)
        .where(IssueAttachment.issue_id == issue_id)
        .options(selectinload(IssueAttachment.uploader))
        .order_by(IssueAttachment.created_at.desc(), IssueAttachment.id.desc())
    ).all()


def get_owned(db, actor, attachment_id: int) -> IssueAttachment:
    attachment = db.get(IssueAttachment, attachment_id)
    if not attachment:
        raise HTTPException(404, "Attachment not found")
    issue_access(db, attachment.issue_id, actor)
    return attachment


def absolute_path(attachment: IssueAttachment) -> Path:
    path = _root() / attachment.storage_path
    if not path.is_file():
        raise HTTPException(404, "File is missing on the server")
    return path


def delete(db, actor, attachment_id: int):
    attachment = get_owned(db, actor, attachment_id)
    issue = issue_access(db, attachment.issue_id, actor)
    path = _root() / attachment.storage_path
    record(
        db,
        actor,
        issue.project_id,
        issue.id,
        "deleted",
        "attachment",
        attachment.filename,
        None,
    )
    db.delete(attachment)
    db.commit()
    if path.is_file():
        path.unlink(missing_ok=True)
    return True


def purge_issue_files(issue_id: int, project_id: int):
    """Best-effort cleanup when an issue is deleted (DB rows cascade)."""
    folder = _root() / str(project_id) / str(issue_id)
    if folder.is_dir():
        for child in folder.iterdir():
            if child.is_file():
                child.unlink(missing_ok=True)
        folder.rmdir()
