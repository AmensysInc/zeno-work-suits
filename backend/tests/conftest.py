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
        yield c
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture
def auth(client):
    response = client.post(
        "/api/auth/register",
        json={
            "first_name": "Alex",
            "last_name": "Rivera",
            "email": "alex@example.com",
            "password": "Password123!",
        },
    )
    return {"Authorization": "Bearer " + response.json()["access_token"]}
