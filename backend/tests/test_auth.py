def test_authentication(client, auth):
    assert client.get("/api/auth/me").status_code == 401
    me = client.get("/api/auth/me", headers=auth)
    assert me.status_code == 200
    assert "password_hash" not in me.json()
    assert (
        client.post(
            "/api/auth/login",
            json={"email": "alex@example.com", "password": "wrongpass"},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"email": "alex@example.com", "password": "Password123!"},
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/auth/register",
            json={
                "first_name": "Alex",
                "last_name": "R",
                "email": "alex@example.com",
                "password": "Password123!",
            },
        ).status_code
        == 409
    )
