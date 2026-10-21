from tests.conftest import create_user


def test_project_chat_requires_project_access(client, auth):
    project = client.post(
        "/api/projects", headers=auth, json={"key": "CHAT", "name": "Chat Project"}
    ).json()
    member_auth = create_user(client, auth, "Nina", "Kim", "member@example.com")
    outsider_auth = create_user(client, auth, "Olivia", "Kim", "outsider@example.com")
    member = client.get("/api/auth/me", headers=member_auth).json()

    denied = client.get(f"/api/projects/{project['id']}/chat", headers=outsider_auth)
    assert denied.status_code == 404
    client.post(
        f"/api/projects/{project['id']}/members",
        headers=auth,
        json={"user_ids": [member["id"]], "role": "TESTER"},
    )

    message = client.post(
        f"/api/projects/{project['id']}/chat",
        headers=member_auth,
        json={"body": "Hello project team"},
    )
    assert message.status_code == 201, message.text
    assert message.json()["body"] == "Hello project team"
    assert message.json()["user"]["email"] == "member@example.com"

    messages = client.get(f"/api/projects/{project['id']}/chat", headers=auth)
    assert messages.status_code == 200
    assert [m["body"] for m in messages.json()] == ["Hello project team"]


def test_project_chat_author_can_edit_and_delete(client, auth):
    project = client.post(
        "/api/projects", headers=auth, json={"key": "EDIT", "name": "Edit Project"}
    ).json()
    other_auth = create_user(client, auth, "Omar", "Kim", "other@example.com")
    other = client.get("/api/auth/me", headers=other_auth).json()
    client.post(
        f"/api/projects/{project['id']}/members",
        headers=auth,
        json={"user_ids": [other["id"]], "role": "DEVELOPER"},
    )
    message = client.post(
        f"/api/projects/{project['id']}/chat",
        headers=auth,
        json={"body": "Original"},
    ).json()

    blocked = client.put(
        f"/api/chat/{message['id']}", headers=other_auth, json={"body": "Nope"}
    )
    assert blocked.status_code == 403

    edited = client.put(
        f"/api/chat/{message['id']}", headers=auth, json={"body": "Updated"}
    )
    assert edited.status_code == 200
    assert edited.json()["body"] == "Updated"

    deleted = client.delete(f"/api/chat/{message['id']}", headers=auth)
    assert deleted.status_code == 204
    messages = client.get(f"/api/projects/{project['id']}/chat", headers=auth)
    assert messages.json() == []
