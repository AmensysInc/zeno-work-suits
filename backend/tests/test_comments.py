def test_comment_ownership_and_activity(client, auth):
    p = client.post(
        "/api/projects", headers=auth, json={"key": "CO", "name": "Comments"}
    ).json()
    i = client.post(
        "/api/issues", headers=auth, json={"project_id": p["id"], "summary": "Story"}
    ).json()
    c = client.post(
        f"/api/issues/{i['id']}/comments",
        headers=auth,
        json={"body": "Ready to review"},
    ).json()
    token = client.post(
        "/api/auth/register",
        json={
            "first_name": "Nina",
            "last_name": "Kim",
            "email": "nina@example.com",
            "password": "Password123!",
        },
    ).json()["access_token"]
    other = {"Authorization": "Bearer " + token}
    assert (
        client.post(
            f"/api/projects/{p['id']}/members",
            headers=auth,
            json={"email": "nina@example.com"},
        ).status_code
        == 200
    )
    assert (
        client.put(
            f"/api/comments/{c['id']}", headers=other, json={"body": "Hijacked"}
        ).status_code
        == 403
    )
    assert client.delete(f"/api/comments/{c['id']}", headers=other).status_code == 403
    assert (
        client.put(
            f"/api/comments/{c['id']}", headers=auth, json={"body": "Updated"}
        ).json()["body"]
        == "Updated"
    )
    client.patch(
        f"/api/issues/{i['id']}/status", headers=auth, json={"status": "TESTING"}
    )
    activity = client.get(f"/api/issues/{i['id']}/activity", headers=auth).json()
    assert any(
        a["new_value"] == "TESTING" and a["old_value"] == "BACKLOG" for a in activity
    )
