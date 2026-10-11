def test_story_criteria(client, auth):
    p = client.post(
        "/api/projects", headers=auth, json={"key": "QA", "name": "QA"}
    ).json()
    story = client.post(
        "/api/issues", headers=auth, json={"project_id": p["id"], "summary": "Story"}
    ).json()
    path = f"/api/issues/{story['id']}/acceptance-criteria"
    c = client.post(
        path, headers=auth, json={"description": "Validates balance"}
    ).json()
    assert client.put(
        f"/api/acceptance-criteria/{c['id']}",
        headers=auth,
        json={"description": "Validates balance", "completed": True, "order_index": 2},
    ).json()["completed"]
    assert len(client.get(path, headers=auth).json()) == 1
    assert (
        client.delete(f"/api/acceptance-criteria/{c['id']}", headers=auth).status_code
        == 204
    )
