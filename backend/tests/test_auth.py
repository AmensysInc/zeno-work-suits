from tests.conftest import create_user


def test_authentication(client, auth):
    assert client.get("/api/auth/me").status_code == 401
    me = client.get("/api/auth/me", headers=auth)
    assert me.status_code == 200
    assert "password_hash" not in me.json()
    assert me.json()["is_admin"] is True
    assert (
        client.post(
            "/api/auth/login",
            json={"email": "alex@example.com", "password": "wrongpass"},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"email": "alex@example.com", "password": "Password123!"},
        ).status_code
        == 200
    )


def test_public_registration_is_disabled(client):
    response = client.post(
        "/api/auth/register",
        json={
            "first_name": "A",
            "last_name": "B",
            "email": "a@example.com",
            "password": "Password123!",
        },
    )
    assert response.status_code in (404, 405)


def test_admin_creates_user_who_must_change_password(client, auth):
    issued = client.post(
        "/api/admin/users",
        headers=auth,
        json={
            "first_name": "Nina",
            "last_name": "Kim",
            "email": "Nina@Example.com",
            "send_email": True,
        },
    )
    assert issued.status_code == 201
    body = issued.json()
    assert body["email_sent"] is False  # no SendGrid key in tests
    assert body["user"]["email"] == "nina@example.com"
    assert body["user"]["must_change_password"] is True
    temp = body["temporary_password"]
    assert len(temp) == 12

    duplicate = client.post(
        "/api/admin/users",
        headers=auth,
        json={"first_name": "N", "last_name": "K", "email": "nina@example.com"},
    )
    assert duplicate.status_code == 409

    token = client.post(
        "/api/auth/login", json={"email": "nina@example.com", "password": temp}
    ).json()["access_token"]
    nina = {"Authorization": "Bearer " + token}
    assert (
        client.get("/api/auth/me", headers=nina).json()["must_change_password"] is True
    )
    assert (
        client.post(
            "/api/auth/change-password",
            headers=nina,
            json={
                "current_password": "wrong-password",
                "new_password": "NinaPassword1!",
            },
        ).status_code
        == 400
    )
    changed = client.post(
        "/api/auth/change-password",
        headers=nina,
        json={"current_password": temp, "new_password": "NinaPassword1!"},
    )
    assert changed.status_code == 200
    assert changed.json()["must_change_password"] is False
    assert (
        client.post(
            "/api/auth/login",
            json={"email": "nina@example.com", "password": "NinaPassword1!"},
        ).status_code
        == 200
    )


def test_only_admins_can_manage_users(client, auth):
    nina = create_user(client, auth, "Nina", "Kim", "nina@example.com")
    assert client.get("/api/admin/users", headers=nina).status_code == 403
    assert (
        client.post(
            "/api/admin/users",
            headers=nina,
            json={"first_name": "X", "last_name": "Y", "email": "x@example.com"},
        ).status_code
        == 403
    )
    users = client.get("/api/admin/users", headers=auth).json()
    assert {u["email"] for u in users} == {"alex@example.com", "nina@example.com"}


def test_disabling_a_user_blocks_access(client, auth):
    nina = create_user(client, auth, "Nina", "Kim", "nina@example.com")
    nina_id = client.get("/api/auth/me", headers=nina).json()["id"]
    assert (
        client.patch(
            f"/api/admin/users/{nina_id}", headers=auth, json={"is_active": False}
        ).status_code
        == 200
    )
    assert client.get("/api/auth/me", headers=nina).status_code == 401
    # Re-enable and reset: the new temporary password works, the old token still doesn't matter.
    client.patch(f"/api/admin/users/{nina_id}", headers=auth, json={"is_active": True})
    reset = client.post(
        f"/api/admin/users/{nina_id}/reset-password",
        headers=auth,
        json={"send_email": False},
    )
    assert reset.status_code == 200
    assert (
        client.post(
            "/api/auth/login",
            json={
                "email": "nina@example.com",
                "password": reset.json()["temporary_password"],
            },
        ).status_code
        == 200
    )


def test_admin_cannot_lock_themselves_out(client, auth):
    me = client.get("/api/auth/me", headers=auth).json()["id"]
    assert (
        client.patch(
            f"/api/admin/users/{me}", headers=auth, json={"role": "MANAGER"}
        ).status_code
        == 400
    )
    assert (
        client.patch(
            f"/api/admin/users/{me}", headers=auth, json={"is_active": False}
        ).status_code
        == 400
    )


def test_admin_sees_all_projects(client, auth):
    nina = create_user(client, auth, "Nina", "Kim", "nina@example.com", role="MANAGER")
    p = client.post(
        "/api/projects", headers=nina, json={"name": "Nina's", "key": "NIN"}
    )
    assert p.status_code == 201, p.text
    assert [x["key"] for x in client.get("/api/projects", headers=auth).json()] == [
        "NIN"
    ]
