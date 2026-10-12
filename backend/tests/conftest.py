import os

os.environ["JWT_SECRET"] = "tests-only-secret-not-for-production-use"
os.environ["DATABASE_URL"] = "sqlite://"
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from app.db.database import Base, get_db
from app.main import app
from app import models
from app.core.security import hash_password


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    @event.listens_for(engine, "connect")
    def fk(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine)

    def override():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        c.sessions = sessions
        yield c
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture
def auth(client):
    """Alex is the administrator (there is no public sign-up; the first admin is seeded)."""
    with client.sessions() as db:
        db.add(
            models.User(
                first_name="Alex",
                last_name="Rivera",
                email="alex@example.com",
                password_hash=hash_password("Password123!"),
                is_admin=True,
            )
        )
        db.commit()
    response = client.post(
        "/api/auth/login", json={"email": "alex@example.com", "password": "Password123!"}
    )
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def create_user(client, admin_headers, first, last, email):
    """Creates a regular user through the admin API and signs them in with the temporary password."""
    issued = client.post(
        "/api/admin/users",
        headers=admin_headers,
        json={"first_name": first, "last_name": last, "email": email, "send_email": False},
    )
    assert issued.status_code == 201, issued.text
    token = client.post(
        "/api/auth/login",
        json={"email": email, "password": issued.json()["temporary_password"]},
    ).json()["access_token"]
    return {"Authorization": "Bearer " + token}
