from tests.conftest import create_user


def _setup(client, auth):
    """A manager's project that the admin (Alex) can see but is not on."""
    manager = create_user(client, auth, "Mona", "Lee", "mona@example.com", role="MANAGER")
    outsider = create_user(client, auth, "Omar", "Diaz", "omar@example.com")
    project = client.post(
        "/api/projects",
        headers=manager,
        json={"name": "Manager project", "key": "MGR", "description": ""},
    ).json()
    admin_id = client.get("/api/auth/me", headers=auth).json()["id"]
    outsider_id = client.get("/api/auth/me", headers=outsider).json()["id"]
    members = client.get(f"/api/projects/{project['id']}", headers=auth).json()["members"]
    assert admin_id not in {m["id"] for m in members}
    return project, admin_id, outsider_id


def test_admin_can_assign_themselves_and_joins_team(client, auth):
    project, admin_id, _ = _setup(client, auth)
    created = client.post(
        "/api/issues",
        headers=auth,
        json={
            "project_id": project["id"],
            "issue_type": "STORY",
            "summary": "Mine",
            "description": "",
            "assignee_ids": [admin_id],
        },
    )
    assert created.status_code == 201, created.text
    issue = created.json()
    assert issue["assignee_id"] == admin_id
    assert [u["id"] for u in issue["assignees"]] == [admin_id]
    members = client.get(f"/api/projects/{project['id']}", headers=auth).json()["members"]
    assert admin_id in {m["id"] for m in members}


def test_admin_can_take_existing_issue_by_edit(client, auth):
    project, admin_id, _ = _setup(client, auth)
    issue = client.post(
        "/api/issues",
        headers=auth,
        json={"project_id": project["id"], "issue_type": "TASK", "summary": "Later", "description": ""},
    ).json()
    edited = client.put(f"/api/issues/{issue['id']}", headers=auth, json={"assignee_ids": [admin_id]})
    assert edited.status_code == 200, edited.text
    assert edited.json()["assignee_id"] == admin_id


def test_non_member_still_cannot_be_assigned(client, auth):
    project, _, outsider_id = _setup(client, auth)
    response = client.post(
        "/api/issues",
        headers=auth,
        json={
            "project_id": project["id"],
            "issue_type": "TASK",
            "summary": "Nope",
            "description": "",
            "assignee_ids": [outsider_id],
        },
    )
    assert response.status_code == 422
