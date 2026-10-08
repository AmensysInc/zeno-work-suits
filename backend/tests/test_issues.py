def test_project_issue_flow_and_isolation(client, auth):
    p = client.post(
        "/api/projects", headers=auth, json={"key": "HRMS", "name": "Quick HRMS"}
    ).json()
    issue = client.post(
        "/api/issues",
        headers=auth,
        json={"project_id": p["id"], "summary": "Request leave"},
    )
    assert issue.status_code == 201, issue.text
    assert issue.json()["issue_key"] == "HRMS-1"
    id = issue.json()["id"]
    assert (
        client.patch(
            f"/api/issues/{id}/status", headers=auth, json={"status": "IN_PROGRESS"}
        ).json()["status"]
        == "IN_PROGRESS"
    )
    assert (
        client.put(
            f"/api/issues/{id}", headers=auth, json={"summary": None}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/issues",
            headers=auth,
            json={"project_id": p["id"], "summary": "Bad", "assignee_id": 999},
        ).status_code
        == 422
    )
    token = client.post(
        "/api/auth/register",
        json={
            "first_name": "Other",
            "last_name": "User",
            "email": "other@example.com",
            "password": "Password123!",
        },
    ).json()["access_token"]
    other = {"Authorization": "Bearer " + token}
    assert client.get("/api/issues", headers=other).json() == []
    assert client.get(f"/api/issues/{id}", headers=other).status_code == 404
    assert client.delete(f"/api/projects/{p['id']}", headers=other).status_code == 404
    assert client.delete(f"/api/projects/{p['id']}", headers=auth).status_code == 204
