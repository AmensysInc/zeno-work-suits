from pathlib import Path
from io import BytesIO
from app.core.config import settings


def test_issue_attachments_upload_list_download_delete(client, auth, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    project = client.post(
        "/api/projects",
        headers=auth,
        json={"name": "Docs", "key": "DOC", "description": ""},
    ).json()
    issue = client.post(
        "/api/issues",
        headers=auth,
        json={
            "project_id": project["id"],
            "issue_type": "TASK",
            "summary": "Attach files",
            "description": "",
        },
    ).json()

    upload = client.post(
        f"/api/issues/{issue['id']}/attachments",
        headers=auth,
        files=[
            ("files", ("spec.pdf", BytesIO(b"%PDF-1.4 demo"), "application/pdf")),
            (
                "files",
                (
                    "notes.docx",
                    BytesIO(b"PK\x03\x04docx"),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ),
            ),
        ],
    )
    assert upload.status_code == 201, upload.text
    body = upload.json()
    assert len(body) == 2
    assert {item["filename"] for item in body} == {"spec.pdf", "notes.docx"}

    listed = client.get(f"/api/issues/{issue['id']}/attachments", headers=auth)
    assert listed.status_code == 200
    assert len(listed.json()) == 2

    first = body[0]
    download = client.get(f"/api/attachments/{first['id']}/download", headers=auth)
    assert download.status_code == 200
    assert download.content.startswith(b"%PDF") or download.content.startswith(b"PK")

    stored = list(Path(tmp_path).rglob("*"))
    assert any(p.is_file() for p in stored)

    deleted = client.delete(f"/api/attachments/{first['id']}", headers=auth)
    assert deleted.status_code == 204
    remaining = client.get(f"/api/issues/{issue['id']}/attachments", headers=auth).json()
    assert len(remaining) == 1


def test_unsupported_attachment_type_is_rejected(client, auth, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    project = client.post(
        "/api/projects",
        headers=auth,
        json={"name": "Docs", "key": "BIN", "description": ""},
    ).json()
    issue = client.post(
        "/api/issues",
        headers=auth,
        json={
            "project_id": project["id"],
            "issue_type": "BUG",
            "summary": "No exees",
            "description": "",
        },
    ).json()
    response = client.post(
        f"/api/issues/{issue['id']}/attachments",
        headers=auth,
        files=[("files", ("payload.exe", BytesIO(b"MZ"), "application/octet-stream"))],
    )
    assert response.status_code == 422
