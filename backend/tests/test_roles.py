from tests.conftest import create_user


def test_admin_adds_people_with_a_role(client, auth):
    person = {
        "first_name": "Priya",
        "last_name": "Shah",
        "email": "Priya@Example.com",
        "role": "MANAGER",
        "send_email": False,
    }
    added = client.post("/api/admin/users", headers=auth, json=person)
    assert added.status_code == 201, added.text
    assert added.json()["user"]["email"] == "priya@example.com"
    assert added.json()["user"]["role"] == "MANAGER"
    assert added.json()["user"]["is_admin"] is False
    assert "password_hash" not in added.json()["user"]
    login = client.post(
        "/api/auth/login",
        json={
            "email": "priya@example.com",
            "password": added.json()["temporary_password"],
        },
    )
    assert login.status_code == 200
    assert (
        client.post(
            "/api/admin/users", headers=auth, json={**person, "role": "OWNER"}
        ).status_code
        == 422
    )
    # Managers run projects but do not manage accounts.
    manager = {"Authorization": "Bearer " + login.json()["access_token"]}
    other = {**person, "email": "other@example.com"}
    assert (
        client.post("/api/admin/users", headers=manager, json=other).status_code == 403
    )


def test_roles_and_admin_access(client, auth):
    me = client.get("/api/auth/me", headers=auth).json()
    assert me["role"] == "ADMIN"
    assert me["is_admin"] is True
    employee = create_user(client, auth, "Nina", "Kim", "nina@example.com")
    nina = client.get("/api/auth/me", headers=employee).json()
    assert nina["role"] == "EMPLOYEE"

    project = client.post(
        "/api/projects", headers=auth, json={"key": "HRMS", "name": "Quick HRMS"}
    ).json()
    denied = client.post(
        "/api/projects", headers=employee, json={"key": "EMP", "name": "Hidden"}
    )
    assert denied.status_code == 403
    hidden = client.get(f"/api/projects/{project['id']}", headers=employee)
    assert hidden.status_code == 404
    assert client.get("/api/auth/users", headers=employee).status_code == 403
    assert (
        client.patch(
            f"/api/admin/users/{nina['id']}",
            headers=employee,
            json={"role": "ADMIN"},
        ).status_code
        == 403
    )

    promoted = client.patch(
        f"/api/admin/users/{nina['id']}", headers=auth, json={"role": "MANAGER"}
    )
    assert promoted.status_code == 200
    assert promoted.json()["role"] == "MANAGER"
    own = client.post(
        "/api/projects", headers=employee, json={"key": "TEAM", "name": "Team"}
    )
    assert own.status_code == 201
    # A manager still cannot see a project they do not belong to.
    still_hidden = client.get(f"/api/projects/{project['id']}", headers=employee)
    assert still_hidden.status_code == 404
    # An admin can, and can change it without being the owner.
    visible = client.get(f"/api/projects/{own.json()['id']}", headers=auth)
    assert visible.status_code == 200
    edited = client.put(
        f"/api/projects/{own.json()['id']}",
        headers=auth,
        json={"name": "Team space", "description": "", "status": "ACTIVE"},
    )
    assert edited.status_code == 200
    assert edited.json()["name"] == "Team space"


def test_demoted_admin_loses_admin_access(client, auth):
    nina = create_user(client, auth, "Nina", "Kim", "nina@example.com", role="ADMIN")
    nina_id = client.get("/api/auth/me", headers=nina).json()["id"]
    me = client.get("/api/auth/me", headers=auth).json()["id"]
    # Another admin can demote Alex.
    assert (
        client.patch(
            f"/api/admin/users/{me}", headers=nina, json={"role": "EMPLOYEE"}
        ).status_code
        == 200
    )
    assert client.get("/api/auth/me", headers=auth).json()["is_admin"] is False
    # Alex can no longer manage accounts.
    assert (
        client.patch(
            f"/api/admin/users/{nina_id}", headers=auth, json={"role": "EMPLOYEE"}
        ).status_code
        == 403
    )
