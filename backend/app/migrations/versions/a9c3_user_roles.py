"""Workspace roles: admin, manager and employee."""

from alembic import op
import sqlalchemy as sa

revision = "a9c3_user_roles"
down_revision = "c7e1_project_board_type"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "role", sa.String(length=20), nullable=False, server_default="EMPLOYEE"
        ),
    )
    # Keep a manager of the workspace: the earliest account, then the demo logins.
    op.execute("UPDATE users SET role = 'ADMIN' WHERE id = (SELECT MIN(id) FROM users)")
    op.execute("UPDATE users SET role = 'ADMIN' WHERE email = 'alex@trackly.demo'")
    op.execute("UPDATE users SET role = 'MANAGER' WHERE email = 'sam@trackly.demo'")
    op.execute("UPDATE users SET role = 'EMPLOYEE' WHERE email = 'nina@trackly.demo'")


def downgrade():
    op.drop_column("users", "role")
