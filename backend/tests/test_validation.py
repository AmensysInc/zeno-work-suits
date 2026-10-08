def project(client, auth, key):
    return client.post(
        "/api/projects", headers=auth, json={"key": key, "name": key}
    ).json()


def test_cross_project_links_are_rejected(client, auth):
    a = project(client, auth, "AA")
    b = project(client, auth, "BB")
    epic = client.post(
        "/api/issues",
        headers=auth,
        json={"project_id": a["id"], "summary": "Epic", "issue_type": "EPIC"},
    ).json()
    response = client.post(
        "/api/issues",
        headers=auth,
        json={"project_id": b["id"], "summary": "Bad link", "epic_id": epic["id"]},
    )
    assert response.status_code == 422
    task = client.post(
        "/api/issues",
        headers=auth,
        json={"project_id": a["id"], "summary": "Task", "issue_type": "TASK"},
    ).json()
    assert (
        client.post(
            "/api/test-cases",
            headers=auth,
            json={
                "project_id": a["id"],
                "issue_id": task["id"],
                "title": "Invalid story",
            },
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/issues",
            headers=auth,
            json={
                "project_id": a["id"],
                "summary": "Missing parent",
                "issue_type": "SUBTASK",
            },
        ).status_code
        == 422
    )


def test_criterion_reorder_is_complete_and_persisted(client, auth):
    p = project(client, auth, "AC")
    i = client.post(
        "/api/issues", headers=auth, json={"project_id": p["id"], "summary": "Story"}
    ).json()
    path = f"/api/issues/{i['id']}/acceptance-criteria"
    a = client.post(path, headers=auth, json={"description": "First"}).json()
    b = client.post(path, headers=auth, json={"description": "Second"}).json()
    assert (
        client.post(
            "/api/acceptance-criteria/reorder",
            headers=auth,
            json={"issue_id": i["id"], "ids": [a["id"]]},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/acceptance-criteria/reorder",
            headers=auth,
            json={"issue_id": i["id"], "ids": [b["id"], a["id"]]},
        ).status_code
        == 200
    )
    assert client.get(path, headers=auth).json()[0]["id"] == b["id"]


def test_one_active_sprint_and_valid_dates(client, auth):
    p = project(client, auth, "SS")
    path = f"/api/projects/{p['id']}/sprints"
    assert (
        client.post(
            path,
            headers=auth,
            json={
                "name": "Bad dates",
                "start_date": "2026-10-30",
                "end_date": "2026-10-19",
            },
        ).status_code
        == 422
    )
    data = {"name": "Sprint", "start_date": "2026-10-19", "end_date": "2026-10-30"}
    a = client.post(path, headers=auth, json=data).json()
    b = client.post(path, headers=auth, json=data).json()
    assert client.post(f"/api/sprints/{a['id']}/start", headers=auth).status_code == 200
    assert client.post(f"/api/sprints/{b['id']}/start", headers=auth).status_code == 409


def test_backlog_order_and_sprint_move_persist(client, auth):
    p = project(client, auth, "DD")
    sprint = client.post(
        f"/api/projects/{p['id']}/sprints", headers=auth, json={"name": "Sprint"}
    ).json()
    a = client.post(
        "/api/issues",
        headers=auth,
        json={"project_id": p["id"], "summary": "First", "order_index": 100},
    ).json()
    b = client.post(
        "/api/issues",
        headers=auth,
        json={"project_id": p["id"], "summary": "Second", "order_index": 200},
    ).json()
    assert (
        client.put(
            f"/api/issues/{b['id']}",
            headers=auth,
            json={"order_index": 50, "sprint_id": sprint["id"]},
        ).status_code
        == 200
    )
    assert (
        client.get(f"/api/issues?project_id={p['id']}", headers=auth).json()[0]["id"]
        == b["id"]
    )
    assert (
        client.put(
            f"/api/issues/{b['id']}", headers=auth, json={"sprint_id": None}
        ).json()["sprint_id"]
        is None
    )
