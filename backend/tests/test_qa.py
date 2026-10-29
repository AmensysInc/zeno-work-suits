from tests.conftest import create_user
from datetime import date


def setup(client, auth):
    p = client.post(
        "/api/projects", headers=auth, json={"key": "QA", "name": "QA"}
    ).json()
    story = client.post(
        "/api/issues", headers=auth, json={"project_id": p["id"], "summary": "Story"}
    ).json()
    criteria = [
        client.post(
            f"/api/issues/{story['id']}/acceptance-criteria",
            headers=auth,
            json={"description": text},
        ).json()
        for text in ("Valid login", "Locked account")
    ]
    return p, story, criteria


def make_test(client, auth, p, story, **extra):
    data = {
        "project_id": p["id"],
        "issue_id": story["id"],
        "title": "Login works",
        "steps": [
            {"step_number": 1, "action": "Open login", "expected_result": "Form"},
            {
                "step_number": 2,
                "action": "Submit",
                "test_data": "user=a@b.c",
                "expected_result": "Home",
            },
        ],
        **extra,
    }
    response = client.post("/api/test-cases", headers=auth, json=data)
    assert response.status_code == 201, response.text
    return response.json(), data


def test_reusable_steps_propagate_and_unlink(client, auth):
    p, story, _ = setup(client, auth)
    shared = client.post(
        "/api/shared-steps",
        headers=auth,
        json={
            "project_id": p["id"],
            "title": "Sign in",
            "action": "Sign in as employee",
            "test_data": "alex / pw",
            "expected_result": "Dashboard",
        },
    ).json()
    tc, _ = make_test(
        client,
        auth,
        p,
        story,
        steps=[{"step_number": 1, "shared_step_id": shared["id"]}],
    )
    assert tc["steps"][0]["action"] == "Sign in as employee"
    assert tc["steps"][0]["test_data"] == "alex / pw"
    edited = client.put(
        f"/api/shared-steps/{shared['id']}",
        headers=auth,
        json={**shared, "action": "Sign in with SSO"},
    ).json()
    assert edited["usage_count"] == 1
    step = client.get(f"/api/test-cases/{tc['id']}", headers=auth).json()["steps"][0]
    assert step["action"] == "Sign in with SSO"
    assert (
        client.delete(f"/api/shared-steps/{shared['id']}", headers=auth).status_code
        == 204
    )
    step = client.get(f"/api/test-cases/{tc['id']}", headers=auth).json()["steps"][0]
    assert step["action"] == "Sign in with SSO" and step["shared_step_id"] is None


def test_step_needs_action_unless_reusable(client, auth):
    p, story, _ = setup(client, auth)
    response = client.post(
        "/api/test-cases",
        headers=auth,
        json={
            "project_id": p["id"],
            "issue_id": story["id"],
            "title": "Empty",
            "steps": [{"step_number": 1, "action": " "}],
        },
    )
    assert response.status_code == 422


def test_criteria_coverage_must_match_story(client, auth):
    p, story, criteria = setup(client, auth)
    tc, data = make_test(client, auth, p, story, criterion_ids=[criteria[0]["id"]])
    assert tc["criterion_ids"] == [criteria[0]["id"]]
    other = client.post(
        "/api/issues", headers=auth, json={"project_id": p["id"], "summary": "Other"}
    ).json()
    foreign = client.post(
        f"/api/issues/{other['id']}/acceptance-criteria",
        headers=auth,
        json={"description": "Elsewhere"},
    ).json()
    data["criterion_ids"] = [foreign["id"]]
    assert (
        client.put(f"/api/test-cases/{tc['id']}", headers=auth, json=data).status_code
        == 422
    )


def test_executions_drive_status_and_keep_history(client, auth):
    p, story, _ = setup(client, auth)
    sprint = client.post(
        f"/api/projects/{p['id']}/sprints",
        headers=auth,
        json={"name": "S1", "start_date": "2026-10-01", "end_date": "2026-10-14"},
    ).json()
    client.post(f"/api/sprints/{sprint['id']}/start", headers=auth)
    tc, data = make_test(client, auth, p, story)
    response = client.post(
        "/api/test-executions",
        headers=auth,
        json={
            "test_case_id": tc["id"],
            "status": "FAILED",
            "actual_result": "500 error",
            "executed_on": "2026-10-05",
            "steps": [
                {"step_number": 1, "status": "PASSED"},
                {"step_number": 2, "status": "FAILED", "actual_result": "500"},
            ],
        },
    )
    assert response.status_code == 201, response.text
    run = response.json()
    assert run["sprint_id"] == sprint["id"], "defaults to the active sprint"
    assert run["tester"]["email"] == "alex@example.com"
    assert run["steps"][1]["test_data"] == "user=a@b.c"
    assert run["test_case_key"] == tc["test_case_key"]
    shown = client.get(f"/api/test-cases/{tc['id']}", headers=auth).json()
    assert shown["status"] == "FAILED" and shown["execution_count"] == 1
    assert shown["last_executed_on"] == "2026-10-05"

    # Editing the test case must not rewrite the recorded run or its result.
    data["steps"][1]["action"] = "Submit twice"
    edited = client.put(f"/api/test-cases/{tc['id']}", headers=auth, json=data).json()
    assert edited["status"] == "FAILED"
    again = client.get(f"/api/test-executions/{run['id']}", headers=auth).json()
    assert again["steps"][1]["action"] == "Submit"

    second = client.post(
        "/api/test-executions",
        headers=auth,
        json={"test_case_id": tc["id"], "status": "PASSED", "sprint_id": None},
    ).json()
    assert second["sprint_id"] is None
    assert second["executed_on"] == date.today().isoformat()
    assert (
        client.get(f"/api/test-cases/{tc['id']}", headers=auth).json()["status"]
        == "PASSED"
    )
    listed = client.get(
        f"/api/test-executions?sprint_id={sprint['id']}", headers=auth
    ).json()
    assert [r["id"] for r in listed] == [run["id"]]

    client.delete(f"/api/test-executions/{second['id']}", headers=auth)
    assert (
        client.get(f"/api/test-cases/{tc['id']}", headers=auth).json()["status"]
        == "FAILED"
    )
    client.delete(f"/api/test-executions/{run['id']}", headers=auth)
    assert (
        client.get(f"/api/test-cases/{tc['id']}", headers=auth).json()["status"]
        == "NOT_RUN"
    )


def test_execution_validation(client, auth):
    p, story, _ = setup(client, auth)
    tc, _ = make_test(client, auth, p, story)
    for body in (
        {"steps": [{"step_number": 9, "status": "PASSED"}]},
        {"steps": [{"step_number": 1}, {"step_number": 1}]},
        {"tester_id": 999},
        {"status": "NOT_RUN"},
    ):
        response = client.post(
            "/api/test-executions",
            headers=auth,
            json={"test_case_id": tc["id"], "status": "PASSED", **body},
        )
        assert response.status_code == 422, body


def test_bug_links_to_failed_run_and_traceability(client, auth):
    p, story, criteria = setup(client, auth)
    tc, _ = make_test(client, auth, p, story, criterion_ids=[criteria[1]["id"]])
    other, _ = make_test(client, auth, p, story, title="Other")
    run = client.post(
        "/api/test-executions",
        headers=auth,
        json={"test_case_id": tc["id"], "status": "FAILED"},
    ).json()
    bug_body = {
        "project_id": p["id"],
        "summary": "Login fails",
        "issue_type": "BUG",
        "related_issue_id": story["id"],
        "related_test_case_id": other["id"],
        "related_execution_id": run["id"],
    }
    assert client.post("/api/issues", headers=auth, json=bug_body).status_code == 422
    bug_body["related_test_case_id"] = tc["id"]
    bug = client.post("/api/issues", headers=auth, json=bug_body)
    assert bug.status_code == 201, bug.text
    assert bug.json()["related_execution_id"] == run["id"]
    subtask = client.post(
        "/api/issues",
        headers=auth,
        json={
            "project_id": p["id"],
            "summary": "Build API",
            "issue_type": "SUBTASK",
            "parent_issue_id": story["id"],
        },
    ).json()

    trace = client.get(f"/api/projects/{p['id']}/traceability", headers=auth)
    assert trace.status_code == 200, trace.text
    row = next(s for s in trace.json()["stories"] if s["id"] == story["id"])
    assert [c["test_case_ids"] for c in row["criteria"]] == [[], [tc["id"]]]
    assert [s["id"] for s in row["subtasks"]] == [subtask["id"]]
    assert [b["related_execution_id"] for b in row["bugs"]] == [run["id"]]
    traced = next(t for t in row["test_cases"] if t["id"] == tc["id"])
    assert traced["last_execution"]["status"] == "FAILED"
    assert traced["last_execution"]["tester"]["first_name"] == "Alex"

    client.delete(f"/api/test-executions/{run['id']}", headers=auth)
    assert (
        client.get(f"/api/issues/{bug.json()['id']}", headers=auth).json()[
            "related_execution_id"
        ]
        is None
    )


def test_qa_data_is_private_to_members(client, auth):
    p, story, _ = setup(client, auth)
    tc, _ = make_test(client, auth, p, story)
    run = client.post(
        "/api/test-executions",
        headers=auth,
        json={"test_case_id": tc["id"], "status": "PASSED"},
    ).json()
    eve = create_user(client, auth, "Eve", "Out", "eve@example.com")
    assert (
        client.get(f"/api/test-executions/{run['id']}", headers=eve).status_code == 404
    )
    assert client.get("/api/test-executions", headers=eve).json() == []
    assert (
        client.get(f"/api/projects/{p['id']}/traceability", headers=eve).status_code
        == 404
    )
    assert (
        client.get(f"/api/shared-steps?project_id={p['id']}", headers=eve).status_code
        == 404
    )
