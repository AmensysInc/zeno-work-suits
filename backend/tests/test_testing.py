def test_testcase_steps_and_bug_links(client, auth):
    p = client.post(
        "/api/projects", headers=auth, json={"key": "TC", "name": "Tests"}
    ).json()
    story = client.post(
        "/api/issues", headers=auth, json={"project_id": p["id"], "summary": "Story"}
    ).json()
    data = {
        "project_id": p["id"],
        "issue_id": story["id"],
        "title": "Valid leave",
        "steps": [
            {"step_number": 1, "action": "Login", "expected_result": "Dashboard"},
            {"step_number": 2, "action": "Submit", "expected_result": "Saved"},
        ],
    }
    response = client.post("/api/test-cases", headers=auth, json=data)
    assert response.status_code == 201, response.text
    tc = response.json()
    assert tc["test_case_key"] == "TC-001"
    data["steps"].reverse()
    edited = client.put(f"/api/test-cases/{tc['id']}", headers=auth, json=data).json()
    assert (
        edited["steps"][0]["action"] == "Submit"
        and edited["steps"][0]["step_number"] == 1
    )
    assert (
        client.patch(
            f"/api/test-cases/{tc['id']}/status",
            headers=auth,
            json={"status": "FAILED"},
        ).json()["status"]
        == "FAILED"
    )
    bug = client.post(
        "/api/issues",
        headers=auth,
        json={
            "project_id": p["id"],
            "summary": "Failure",
            "issue_type": "BUG",
            "related_issue_id": story["id"],
            "related_test_case_id": tc["id"],
        },
    )
    assert bug.status_code == 201, bug.text
    assert bug.json()["related_test_case_id"] == tc["id"]
    assert client.delete(f"/api/test-cases/{tc['id']}", headers=auth).status_code == 204
    assert (
        client.get(f"/api/issues/{bug.json()['id']}", headers=auth).json()[
            "related_test_case_id"
        ]
        is None
    )
