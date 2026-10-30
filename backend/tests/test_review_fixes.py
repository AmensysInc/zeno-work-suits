"""Permissions, sign-in safety, automations and data fixes from the code review."""

from app.core.config import settings
from app.services import automations, github
from tests.conftest import create_user


def project(client, auth, key="REV"):
    response = client.post(
        "/api/projects", headers=auth, json={"key": key, "name": key}
    )
    assert response.status_code == 201, response.text
    return response.json()


def issue(client, headers, project_id, **extra):
    response = client.post(
        "/api/issues",
        headers=headers,
        json={"project_id": project_id, "summary": "Work", **extra},
    )
    assert response.status_code == 201, response.text
    return response.json()


def member(client, auth, project_id, first, email, role="DEVELOPER"):
    headers = create_user(client, auth, first, "Member", email)
    added = client.post(
        f"/api/projects/{project_id}/members",
        headers=auth,
        json={"email": email, "role": role},
    )
    assert added.status_code == 200, added.text
    return headers


def test_deleting_a_story_takes_its_subtasks(client, auth):
    p = project(client, auth)
    story = issue(client, auth, p["id"], issue_type="STORY")
    sub = issue(
        client, auth, p["id"], issue_type="SUBTASK", parent_issue_id=story["id"]
    )
    assert client.delete(f"/api/issues/{story['id']}", headers=auth).status_code == 204
    assert client.get(f"/api/issues/{sub['id']}", headers=auth).status_code == 404


def test_orphaned_subtask_can_still_move(client, auth):
    """Subtasks orphaned before the fix are no longer stuck."""
    p = project(client, auth)
    story = issue(client, auth, p["id"], issue_type="STORY")
    sub = issue(
        client, auth, p["id"], issue_type="SUBTASK", parent_issue_id=story["id"]
    )
    with client.sessions() as db:
        from app.models import Issue

        db.get(Issue, sub["id"]).parent_issue_id = None
        db.commit()
    moved = client.patch(
        f"/api/issues/{sub['id']}/status", headers=auth, json={"status": "DONE"}
    )
    assert moved.status_code == 200, moved.text
    # Clearing a parent on purpose is still refused.
    cleared = client.put(
        f"/api/issues/{sub['id']}", headers=auth, json={"parent_issue_id": None}
    )
    assert cleared.status_code == 422


def test_leads_run_sprints_and_delete_work(client, auth):
    p = project(client, auth)
    dev = member(client, auth, p["id"], "Dev", "dev@example.com")
    lead = member(client, auth, p["id"], "Lea", "lead@example.com", role="LEAD")
    sprint_body = {"name": "S1", "start_date": "2026-10-01", "end_date": "2026-10-14"}
    url = f"/api/projects/{p['id']}/sprints"
    assert client.post(url, headers=dev, json=sprint_body).status_code == 403
    sprint = client.post(url, headers=lead, json=sprint_body).json()
    assert (
        client.post(f"/api/sprints/{sprint['id']}/start", headers=dev).status_code
        == 403
    )
    assert (
        client.post(f"/api/sprints/{sprint['id']}/start", headers=lead).status_code
        == 200
    )

    story = issue(client, dev, p["id"], issue_type="STORY")
    assert client.delete(f"/api/issues/{story['id']}", headers=dev).status_code == 403
    # Developers still create and move work.
    assert (
        client.patch(
            f"/api/issues/{story['id']}/status", headers=dev, json={"status": "TODO"}
        ).status_code
        == 200
    )
    assert client.delete(f"/api/issues/{story['id']}", headers=lead).status_code == 204


def test_test_results_come_from_runs(client, auth):
    p = project(client, auth)
    dev = member(client, auth, p["id"], "Dev", "dev@example.com")
    tester = member(client, auth, p["id"], "Tess", "tess@example.com", role="TESTER")
    story = issue(client, auth, p["id"], issue_type="STORY")
    created = client.post(
        "/api/test-cases",
        headers=dev,
        json={
            "project_id": p["id"],
            "issue_id": story["id"],
            "title": "Login",
            "status": "PASSED",
            "steps": [
                {"step_number": 1, "action": "Sign in", "expected_result": "Home"}
            ],
        },
    ).json()
    assert created["status"] == "NOT_RUN"
    override = f"/api/test-cases/{created['id']}/status"
    assert (
        client.patch(override, headers=dev, json={"status": "PASSED"}).status_code
        == 403
    )

    run = client.post(
        "/api/test-executions",
        headers=tester,
        json={"test_case_id": created["id"], "status": "FAILED"},
    ).json()
    # Run history is removed only by its tester or a lead.
    assert (
        client.delete(f"/api/test-executions/{run['id']}", headers=dev).status_code
        == 403
    )
    assert (
        client.delete(f"/api/test-executions/{run['id']}", headers=tester).status_code
        == 204
    )
    assert (
        client.delete(f"/api/test-cases/{created['id']}", headers=dev).status_code
        == 403
    )
    assert (
        client.delete(f"/api/test-cases/{created['id']}", headers=auth).status_code
        == 204
    )


def test_temporary_password_must_be_replaced_first(client, auth):
    issued = client.post(
        "/api/admin/users",
        headers=auth,
        json={
            "first_name": "Tia",
            "last_name": "Temp",
            "email": "tia@example.com",
            "role": "EMPLOYEE",
            "send_email": False,
        },
    ).json()
    temporary = issued["temporary_password"]
    token = client.post(
        "/api/auth/login", json={"email": "tia@example.com", "password": temporary}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/auth/me", headers=headers).status_code == 200
    blocked = client.get("/api/projects", headers=headers)
    assert blocked.status_code == 403
    assert "new password" in blocked.json()["detail"]

    changed = client.post(
        "/api/auth/change-password",
        headers=headers,
        json={"current_password": temporary, "new_password": "Brand-new-pass1"},
    )
    assert changed.status_code == 200, changed.text
    fresh = {"Authorization": f"Bearer {changed.json()['access_token']}"}
    assert client.get("/api/projects", headers=fresh).status_code == 200
    # The token issued with the temporary password is signed out.
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_reset_signs_out_existing_sessions(client, auth):
    user = create_user(client, auth, "Old", "Token", "old@example.com")
    user_id = client.get("/api/auth/me", headers=user).json()["id"]
    reset = client.post(
        f"/api/admin/users/{user_id}/reset-password",
        headers=auth,
        json={"send_email": False},
    )
    assert reset.status_code == 200
    assert client.get("/api/auth/me", headers=user).status_code == 401


def test_repeated_failed_sign_ins_are_throttled(client, auth):
    wrong = {"email": "alex@example.com", "password": "Wrong-password1"}
    for _ in range(5):
        assert client.post("/api/auth/login", json=wrong).status_code == 401
    locked = client.post(
        "/api/auth/login",
        json={"email": "alex@example.com", "password": "Password123!"},
    )
    assert locked.status_code == 429
    assert "Try again in 15 minutes" in locked.json()["detail"]


def test_automation_rules_run_on_status_change(client, auth, monkeypatch):
    p = project(client, auth)
    dev = member(client, auth, p["id"], "Dev", "dev@example.com")
    dev_id = client.get("/api/auth/me", headers=dev).json()["id"]
    sent = []
    monkeypatch.setattr(
        automations,
        "send_issue_update",
        lambda person, issue, message: sent.append((person.email, message)),
    )
    for action in ("CREATE_BUG", "NOTIFY_ASSIGNEE"):
        rule = client.post(
            "/api/automations",
            headers=auth,
            json={
                "name": action,
                "project_id": p["id"],
                "to_status": "TESTING",
                "action": action,
            },
        )
        assert rule.status_code == 201, rule.text
    story = issue(client, auth, p["id"], issue_type="STORY", assignee_id=dev_id)
    client.patch(
        f"/api/issues/{story['id']}/status",
        headers=auth,
        json={"status": "IN_PROGRESS"},
    )
    assert sent == []
    client.patch(
        f"/api/issues/{story['id']}/status", headers=auth, json={"status": "TESTING"}
    )
    bugs = [
        i
        for i in client.get(f"/api/issues?project_id={p['id']}", headers=auth).json()
        if i["issue_type"] == "BUG"
    ]
    assert len(bugs) == 1
    assert bugs[0]["related_issue_id"] == story["id"]
    assert sent == [("dev@example.com", f"{story['issue_key']} moved to Testing")]


def test_leads_can_remove_others_comments(client, auth):
    p = project(client, auth)
    dev = member(client, auth, p["id"], "Dev", "dev@example.com")
    other = member(client, auth, p["id"], "Oli", "oli@example.com")
    story = issue(client, auth, p["id"], issue_type="STORY")
    comment = client.post(
        f"/api/issues/{story['id']}/comments", headers=dev, json={"body": "Spam"}
    ).json()
    url = f"/api/comments/{comment['id']}"
    assert client.put(url, headers=auth, json={"body": "Edited"}).status_code == 403
    assert client.delete(url, headers=other).status_code == 403
    assert client.delete(url, headers=auth).status_code == 204


def test_managers_cannot_take_another_teams_repository(client, auth, monkeypatch):
    repo = {
        "html_url": "https://github.com/acme/hr-portal",
        "full_name": "acme/hr-portal",
    }
    monkeypatch.setattr(settings, "github_token", "test-token")
    monkeypatch.setattr(github, "call", lambda method, path, **kwargs: repo)
    theirs = project(client, auth, "THEIRS")
    url = f"/api/github/projects/{theirs['id']}/repository"
    assert (
        client.put(url, headers=auth, json={"full_name": "acme/hr-portal"}).status_code
        == 200
    )

    manager = create_user(
        client, auth, "Max", "Manager", "max@example.com", role="MANAGER"
    )
    mine = project(client, manager, "MINE")
    url = f"/api/github/projects/{mine['id']}/repository"
    taken = client.put(url, headers=manager, json={"full_name": "acme/hr-portal"})
    assert taken.status_code == 403
    monkeypatch.setattr(settings, "github_allowed_owners", ["amensys"])
    outside = client.put(url, headers=manager, json={"full_name": "acme/other"})
    assert outside.status_code == 403


def test_issue_list_reports_when_work_was_done(client, auth):
    p = project(client, auth)
    story = issue(client, auth, p["id"], issue_type="STORY")
    client.patch(
        f"/api/issues/{story['id']}/status", headers=auth, json={"status": "DONE"}
    )
    [listed] = client.get(f"/api/issues?project_id={p['id']}", headers=auth).json()
    assert listed["resolved_at"] is not None
