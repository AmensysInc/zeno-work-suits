def test_sprint_lifecycle(client, auth):
    p = client.post(
        "/api/projects", headers=auth, json={"key": "SP", "name": "Sprint project"}
    ).json()
    s = client.post(
        f"/api/projects/{p['id']}/sprints",
        headers=auth,
        json={"name": "Sprint 1", "start_date": "2026-10-19", "end_date": "2026-10-30"},
    ).json()
    i = client.post(
        "/api/issues",
        headers=auth,
        json={"project_id": p["id"], "summary": "Unfinished", "sprint_id": s["id"]},
    ).json()
    assert (
        client.post(f"/api/sprints/{s['id']}/start", headers=auth).json()["status"]
        == "ACTIVE"
    )
    assert client.get(f"/api/issues/{i['id']}", headers=auth).json()["status"] == "TODO"
    assert client.post(f"/api/sprints/{s['id']}/start", headers=auth).status_code == 409
    late = client.post(
        "/api/issues",
        headers=auth,
        json={
            "project_id": p["id"],
            "summary": "Added during sprint",
            "sprint_id": s["id"],
        },
    ).json()
    assert late["status"] == "TODO"
    backlog = client.post(
        "/api/issues",
        headers=auth,
        json={"project_id": p["id"], "summary": "Move from backlog"},
    ).json()
    moved = client.put(
        f"/api/issues/{backlog['id']}", headers=auth, json={"sprint_id": s["id"]}
    ).json()
    assert moved["status"] == "TODO"
    assert (
        client.post(f"/api/sprints/{s['id']}/complete", headers=auth).json()["status"]
        == "COMPLETED"
    )
    assert (
        client.get(f"/api/issues/{i['id']}", headers=auth).json()["sprint_id"] is None
    )
    assert (
        client.put(
            f"/api/issues/{i['id']}", headers=auth, json={"sprint_id": s["id"]}
        ).status_code
        == 422
    )
