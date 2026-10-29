from tests.conftest import create_user


def test_create_and_list_automation_rule(client, auth):
    project = client.post(
        "/api/projects", headers=auth, json={"key": "AUTO", "name": "Automation"}
    ).json()
    created = client.post(
        "/api/automations",
        headers=auth,
        json={
            "name": "Notify on done",
            "project_id": project["id"],
            "to_status": "DONE",
            "action": "NOTIFY_REPORTER",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["name"] == "Notify on done"
    assert created.json()["project"]["name"] == "Automation"

    rules = client.get("/api/automations", headers=auth)
    assert rules.status_code == 200
    assert [rule["name"] for rule in rules.json()] == ["Notify on done"]


def test_automation_project_access_and_delete_owner(client, auth):
    project = client.post(
        "/api/projects", headers=auth, json={"key": "LOCK", "name": "Private"}
    ).json()
    outsider_auth = create_user(client, auth, "Olivia", "Kim", "outsider@example.com")
    blocked = client.post(
        "/api/automations",
        headers=outsider_auth,
        json={
            "name": "Blocked",
            "project_id": project["id"],
            "to_status": "DONE",
        },
    )
    assert blocked.status_code == 404

    own = client.post(
        "/api/automations",
        headers=outsider_auth,
        json={"name": "Personal rule", "to_status": "TESTING"},
    )
    assert own.status_code == 201
    assert (
        client.delete(f"/api/automations/{own.json()['id']}", headers=auth).status_code
        == 204
    )
