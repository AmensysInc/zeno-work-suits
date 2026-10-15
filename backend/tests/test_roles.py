def register(client, email, first="Nina"):
    response = client.post(
        "/api/auth/register",
        json={
            "first_name": first,
            "last_name": "Kim",
            "email": email,
            "password": "Password123!",
        },
    )
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def test_admin_adds_people(client, auth):
    person = {
        "first_name": "Priya",
        "last_name": "Shah",
        "email": "Priya@Example.com",
        "password": "Welcome123!",
        "role": "MANAGER",
    }
    added = client.post("/api/auth/users", headers=auth, json=person)
    assert added.status_code == 201, added.text
    assert added.json()["email"] == "priya@example.com"
    assert added.json()["role"] == "MANAGER"
    assert "password_hash" not in added.json()
    # They can sign in with the password the admin set.
    login = client.post(
        "/api/auth/login",
        json={"email": "priya@example.com", "password": "Welcome123!"},
    )
    assert login.status_code == 200
    assert client.post("/api/auth/users", headers=auth, json=person).status_code == 409
    assert (
        client.post(
            "/api/auth/users", headers=auth, json={**person, "password": "short"}
        ).status_code
        == 422
    )
    manager = {"Authorization": "Bearer " + login.json()["access_token"]}
    other = {**person, "email": "other@example.com"}
    assert client.post("/api/auth/users", headers=manager, json=other).status_code == 403


def test_roles_and_admin_access(client, auth):
    me = client.get("/api/auth/me", headers=auth).json()
    assert me["role"] == "ADMIN"
    employee = register(client, "nina@example.com")
    nina = client.get("/api/auth/me", headers=employee).json()
    assert nina["role"] == "EMPLOYEE"
    # A new account cannot pick its own role.
    assert (
        client.post(
            "/api/auth/register",
            json={
                "first_name": "Sam",
                "last_name": "Patel",
                "email": "sam@example.com",
                "password": "Password123!",
                "role": "ADMIN",
            },
        ).status_code
        == 201
    )
    logged_in = client.post(
        "/api/auth/login",
        json={"email": "sam@example.com", "password": "Password123!"},
    )
    manager = {"Authorization": "Bearer " + logged_in.json()["access_token"]}
    assert client.get("/api/auth/me", headers=manager).json()["role"] == "EMPLOYEE"

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
            f"/api/auth/users/{nina['id']}",
            headers=employee,
            json={"role": "ADMIN"},
        ).status_code
        == 403
    )

    promoted = client.patch(
        f"/api/auth/users/{nina['id']}", headers=auth, json={"role": "MANAGER"}
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

    assert (
        client.patch(
            f"/api/auth/users/{me['id']}", headers=auth, json={"role": "EMPLOYEE"}
        ).status_code
        == 422
    )
    client.patch(
        f"/api/auth/users/{nina['id']}", headers=auth, json={"role": "ADMIN"}
    )
    assert (
        client.patch(
            f"/api/auth/users/{me['id']}", headers=auth, json={"role": "EMPLOYEE"}
        ).status_code
        == 200
    )
