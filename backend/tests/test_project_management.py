from tests.conftest import create_user


def project(client, auth, key="PM", **extra):
    return client.post(
        "/api/projects", headers=auth, json={"key": key, "name": "Project", **extra}
    ).json()


def issue(client, auth, pid, summary="Work", **extra):
    response = client.post(
        "/api/issues",
        headers=auth,
        json={"project_id": pid, "summary": summary, **extra},
    )
    assert response.status_code == 201, response.text
    return response.json()


def sprint(client, auth, pid, name="Sprint 1"):
    return client.post(
        f"/api/projects/{pid}/sprints",
        headers=auth,
        json={"name": name, "start_date": "2026-10-05", "end_date": "2026-10-16"},
    ).json()


def test_board_type_setting(client, auth):
    p = project(client, auth)
    assert p["board_type"] == "SCRUM"
    kanban = project(client, auth, "KB", board_type="KANBAN")
    assert kanban["board_type"] == "KANBAN"
    # Updates that omit the board type keep it.
    updated = client.put(
        f"/api/projects/{kanban['id']}",
        headers=auth,
        json={"name": "Renamed", "description": "", "status": "ACTIVE"},
    ).json()
    assert updated["board_type"] == "KANBAN"
    switched = client.put(
        f"/api/projects/{p['id']}",
        headers=auth,
        json={"name": "Project", "board_type": "KANBAN"},
    ).json()
    assert switched["board_type"] == "KANBAN"
    bad = client.put(
        f"/api/projects/{p['id']}",
        headers=auth,
        json={"name": "Project", "board_type": "WATERFALL"},
    )
    assert bad.status_code == 422


def test_remove_member_unassigns_open_work(client, auth):
    p = project(client, auth)
    nina = create_user(client, auth, "Nina", "Patel", "nina@example.com")
    members = client.post(
        f"/api/projects/{p['id']}/members",
        headers=auth,
        json={"email": "nina@example.com"},
    ).json()["members"]
    nina_id = next(u["id"] for u in members if u["email"] == "nina@example.com")
    owner_id = p["owner_id"]
    open_work = issue(client, auth, p["id"], assignee_id=nina_id)
    done = issue(client, auth, p["id"], assignee_id=nina_id, status="DONE")
    # Only the owner may remove people, and never the owner themself.
    assert (
        client.delete(
            f"/api/projects/{p['id']}/members/{owner_id}", headers=nina
        ).status_code
        == 403
    )
    assert (
        client.delete(
            f"/api/projects/{p['id']}/members/{owner_id}", headers=auth
        ).status_code
        == 422
    )
    result = client.delete(f"/api/projects/{p['id']}/members/{nina_id}", headers=auth)
    assert result.status_code == 200
    assert nina_id not in [u["id"] for u in result.json()["members"]]
    get = lambda i: client.get(f"/api/issues/{i['id']}", headers=auth).json()
    assert get(open_work)["assignee_id"] is None
    assert get(done)["assignee_id"] == nina_id
    # A removed member loses access to the project.
    assert client.get(f"/api/projects/{p['id']}", headers=nina).status_code == 404
    assert (
        client.delete(
            f"/api/projects/{p['id']}/members/{nina_id}", headers=auth
        ).status_code
        == 404
    )


def test_bulk_update_is_atomic_and_isolated(client, auth):
    p = project(client, auth)
    s = sprint(client, auth, p["id"])
    a = issue(client, auth, p["id"], "A")
    b = issue(client, auth, p["id"], "B")
    epic = issue(client, auth, p["id"], "Epic", issue_type="EPIC")
    moved = client.patch(
        "/api/issues/bulk",
        headers=auth,
        json={"ids": [a["id"], b["id"]], "changes": {"sprint_id": s["id"]}},
    )
    assert moved.status_code == 200, moved.text
    assert {i["sprint_id"] for i in moved.json()} == {s["id"]}
    back = client.patch(
        "/api/issues/bulk",
        headers=auth,
        json={"ids": [a["id"], b["id"]], "changes": {"sprint_id": None}},
    ).json()
    assert {i["sprint_id"] for i in back} == {None}
    # Epics cannot join sprints, so the whole batch is rejected.
    rollback = client.patch(
        "/api/issues/bulk",
        headers=auth,
        json={"ids": [b["id"], epic["id"]], "changes": {"sprint_id": s["id"]}},
    )
    assert rollback.status_code == 422
    assert client.get(f"/api/issues/{b['id']}", headers=auth).json()["sprint_id"] is None
    # Another user's issues cannot be touched through a batch.
    other = create_user(client, auth, "Sam", "Patel", "sam@example.com")
    stranger = client.patch(
        "/api/issues/bulk",
        headers=other,
        json={"ids": [a["id"]], "changes": {"priority": "LOW"}},
    )
    assert stranger.status_code == 404
    assert (
        client.patch(
            "/api/issues/bulk", headers=auth, json={"ids": [], "changes": {}}
        ).status_code
        == 422
    )


def test_leaving_a_sprint_returns_unstarted_work_to_backlog(client, auth):
    p = project(client, auth)
    s = sprint(client, auth, p["id"])
    todo = issue(client, auth, p["id"], "Todo", sprint_id=s["id"])
    started = issue(client, auth, p["id"], "Started", sprint_id=s["id"])
    client.post(f"/api/sprints/{s['id']}/start", headers=auth)
    client.patch(
        f"/api/issues/{started['id']}/status",
        headers=auth,
        json={"status": "IN_PROGRESS"},
    )
    for i in (todo, started):
        client.put(f"/api/issues/{i['id']}", headers=auth, json={"sprint_id": None})
    get = lambda i: client.get(f"/api/issues/{i['id']}", headers=auth).json()
    assert get(todo)["status"] == "BACKLOG"
    assert get(started)["status"] == "IN_PROGRESS"


def test_delete_sprint_and_carry_over(client, auth):
    p = project(client, auth)
    s1 = sprint(client, auth, p["id"])
    s2 = sprint(client, auth, p["id"], "Sprint 2")
    s3 = sprint(client, auth, p["id"], "Sprint 3")
    finished = issue(client, auth, p["id"], "Done", sprint_id=s1["id"], story_points=3)
    unfinished = issue(
        client, auth, p["id"], "Open", sprint_id=s1["id"], story_points=5
    )
    planned = issue(client, auth, p["id"], "Planned", sprint_id=s3["id"])
    client.post(f"/api/sprints/{s1['id']}/start", headers=auth)
    client.patch(
        f"/api/issues/{finished['id']}/status", headers=auth, json={"status": "DONE"}
    )
    client.patch(
        f"/api/issues/{unfinished['id']}/status",
        headers=auth,
        json={"status": "IN_PROGRESS"},
    )
    # Active sprints cannot be deleted, nor can work move into a non-planned sprint.
    assert client.delete(f"/api/sprints/{s1['id']}", headers=auth).status_code == 409
    assert (
        client.post(
            f"/api/sprints/{s1['id']}/complete",
            headers=auth,
            json={"move_to_sprint_id": s1["id"]},
        ).status_code
        == 422
    )
    done = client.post(
        f"/api/sprints/{s1['id']}/complete",
        headers=auth,
        json={"move_to_sprint_id": s2["id"]},
    )
    assert done.json()["status"] == "COMPLETED"
    carried = client.get(f"/api/issues/{unfinished['id']}", headers=auth).json()
    assert carried["sprint_id"] == s2["id"]
    assert carried["status"] == "IN_PROGRESS"
    assert (
        client.get(f"/api/issues/{finished['id']}", headers=auth).json()["sprint_id"]
        == s1["id"]
    )
    assert client.delete(f"/api/sprints/{s1['id']}", headers=auth).status_code == 409
    assert client.delete(f"/api/sprints/{s3['id']}", headers=auth).status_code == 204
    left = client.get(f"/api/issues/{planned['id']}", headers=auth).json()
    assert left["sprint_id"] is None and left["status"] == "BACKLOG"
    ids = [x["id"] for x in client.get(f"/api/projects/{p['id']}/sprints", headers=auth).json()]
    assert s3["id"] not in ids
    other = create_user(client, auth, "Sam", "Patel", "sam@example.com")
    assert client.delete(f"/api/sprints/{s2['id']}", headers=other).status_code == 404

    report = client.get(f"/api/projects/{p['id']}/reports", headers=auth)
    assert report.status_code == 200, report.text
    data = report.json()
    first = next(v for v in data["velocity"] if v["sprint_id"] == s1["id"])
    assert first["committed_points"] == 8
    assert first["completed_points"] == 3
    assert data["summary"]["average_velocity"] == 3
    assert data["burndown"]["sprint_id"] == s1["id"]
    assert data["burndown"]["total_points"] == 8


def test_reports(client, auth):
    p = project(client, auth)
    s = sprint(client, auth, p["id"])
    a = issue(client, auth, p["id"], "A", sprint_id=s["id"], story_points=5)
    issue(client, auth, p["id"], "B", sprint_id=s["id"], story_points=3)
    issue(client, auth, p["id"], "Bug", issue_type="BUG", priority="CRITICAL")
    issue(client, auth, p["id"], "Epic", issue_type="EPIC", story_points=40)
    client.post(f"/api/sprints/{s['id']}/start", headers=auth)
    client.patch(f"/api/issues/{a['id']}/status", headers=auth, json={"status": "DONE"})
    data = client.get(f"/api/projects/{p['id']}/reports", headers=auth).json()
    summary = data["summary"]
    # Epics are containers, so they are left out of the counts.
    assert summary["total_issues"] == 3
    assert summary["done_points"] == 5
    assert summary["total_points"] == 8
    assert summary["open_bugs"] == 1
    assert {c["key"]: c["count"] for c in data["by_priority"]}["CRITICAL"] == 1
    assert data["velocity"][0]["committed_points"] == 8
    burndown = data["burndown"]
    assert burndown["total_points"] == 8
    assert len(burndown["days"]) == 12
    assert burndown["days"][0]["ideal"] == 8
    assert burndown["days"][-1]["ideal"] == 0
    assert len(data["created_vs_resolved"]) == 8
    assert sum(w["resolved"] for w in data["created_vs_resolved"]) == 1
    owner = next(w for w in data["workload"] if w["user"] is None)
    assert owner["open_issues"] == 2
    other = create_user(client, auth, "Sam", "Patel", "sam@example.com")
    assert (
        client.get(f"/api/projects/{p['id']}/reports", headers=other).status_code
        == 404
    )
