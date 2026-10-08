"""Verify real PostgreSQL migrations in a disposable database.

Run from backend/: python scripts/verify_postgres.py
Uses DATABASE_URL from .env. The configured role needs CREATEDB.
"""

import os
import subprocess
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import psycopg
from psycopg import sql
from sqlalchemy.engine import make_url
from app.core.config import settings

url = make_url(settings.database_url)
name = "trackly_verify_" + uuid.uuid4().hex[:12]
admin = url.set(database="postgres", drivername="postgresql")
test_url = url.set(database=name)
with psycopg.connect(
    admin.render_as_string(hide_password=False), autocommit=True
) as conn:
    conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
    try:
        env = {
            **os.environ,
            "DATABASE_URL": test_url.render_as_string(hide_password=False),
        }
        for args in [
            ("upgrade", "head"),
            ("check",),
            ("downgrade", "base"),
            ("upgrade", "head"),
            ("check",),
        ]:
            subprocess.run(
                [sys.executable, "-m", "alembic", *args], env=env, check=True
            )
        with psycopg.connect(
            test_url.set(drivername="postgresql").render_as_string(hide_password=False)
        ) as test:
            assert (
                test.execute(
                    "SELECT count(*) FROM pg_constraint WHERE conname='fk_issue_related_test'"
                ).fetchone()[0]
                == 1
            )
        print(
            "PostgreSQL upgrade, downgrade, upgrade, schema drift and circular foreign key checks passed."
        )
    finally:
        conn.execute(
            sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(name))
        )
