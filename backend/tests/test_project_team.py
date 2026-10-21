from tests.conftest import create_user


def me(client, headers):
    return client.get("/api/auth/me", headers=headers).json()


def test_project_schedule_and_repository(client, auth):
    created = client.post(
        "/api/projects",
        headers=auth,
        json={
            "key": "HR",
            "name": "HR",
            "start_date": "2026-11-01",
            "end_date": "2026-12-31",
            "code_freeze_date": "2026-12-10",
            "testing_date": "2026-12-12",
            "github_repo": "https://github.com/acme/hr-portal",
        },
    )
    assert created.status_code == 201, created.text
    p = created.json()
    assert p["code_freeze_date"] == "2026-12-10"
    assert p["github_repo"] == "https://github.com/acme/hr-portal"
    assert p["team"][0]["role"] == "LEAD"
    bad = [
        {"start_date": "2026-11-10", "end_date": "2026-11-01"},
        {"start_date": "2026-11-01", "code_freeze_date": "2026-10-01"},
        {"end_date": "2026-11-01", "testing_date": "2026-11-05"},
        {"github_repo": "https://gitlab.com/acme/hr"},
    ]
    for i, extra in enumerate(bad):
        response = client.post(
            "/api/projects",
            headers=auth,
            json={"key": f"BAD{i}", "name": "Bad", **extra},
        )
        assert response.status_code == 422, extra
    # Blank dates from a form are treated as "not set".
    blank = client.post(
        "/api/projects",
        headers=auth,
        json={"key": "BL", "name": "Blank", "start_date": "", "github_repo": ""},
    )
    assert blank.status_code == 201
    assert blank.json()["start_date"] is None
    # Updates are checked against the dates already saved.
    late = client.put(
        f"/api/projects/{p['id']}",
        headers=auth,
        json={"name": "HR", "testing_date": "2027-01-15"},
    )
    assert late.status_code == 422
    cleared = client.put(
        f"/api/projects/{p['id']}",
        headers=auth,
        json={"name": "HR", "end_date": None, "testing_date": "2027-01-15"},
    )
    assert cleared.status_code == 200
    assert cleared.json()["end_date"] is None


def test_assign_team_members_with_project_roles(client, auth):
    nina = create_user(client, auth, "Nina", "Kim", "nina@example.com")
    sam = create_user(client, auth, "Sam", "Kim", "sam@example.com")
    nina_id, sam_id = me(client, nina)["id"], me(client, sam)["id"]
    p = client.post(
        "/api/projects", headers=auth, json={"key": "TM", "name": "Team"}
    ).json()
    assert client.get(f"/api/projects/{p['id']}", headers=nina).status_code == 404

    assigned = client.post(
        f"/api/projects/{p['id']}/members",
        headers=auth,
        json={"user_ids": [nina_id, sam_id], "role": "TESTER"},
    )
    assert assigned.status_code == 200, assigned.text
    roles = {m["user"]["id"]: m["role"] for m in assigned.json()["team"]}
    assert roles[nina_id] == roles[sam_id] == "TESTER"
    # The project now shows up for the people assigned to it.
    assert [x["id"] for x in client.get("/api/projects", headers=nina).json()] == [
        p["id"]
    ]

    # Assigning again changes their role instead of adding them twice.
    changed = client.post(
        f"/api/projects/{p['id']}/members",
        headers=auth,
        json={"user_ids": [sam_id], "role": "DESIGNER"},
    ).json()
    assert len(changed["team"]) == 3
    assert {m["user"]["id"]: m["role"] for m in changed["team"]}[sam_id] == "DESIGNER"

    for body, status in [
        ({"user_ids": [nina_id], "role": "CEO"}, 422),
        ({"role": "DEVELOPER"}, 422),
        ({"user_ids": [9999], "role": "DEVELOPER"}, 404),
    ]:
        response = client.post(
            f"/api/projects/{p['id']}/members", headers=auth, json=body
        )
        assert response.status_code == status, body
    # Employees on the project cannot assign people.
    assert (
        client.post(
            f"/api/projects/{p['id']}/members",
            headers=nina,
            json={"user_ids": [nina_id], "role": "LEAD"},
        ).status_code
        == 403
    )
    # Managers can list people to assign; employees cannot.
    client.patch(f"/api/admin/users/{sam_id}", headers=auth, json={"role": "MANAGER"})
    assert client.get("/api/auth/users", headers=sam).status_code == 200
    assert client.get("/api/auth/users", headers=nina).status_code == 403
