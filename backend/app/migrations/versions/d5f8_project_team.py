"""Project schedule, GitHub repository and per-project member roles."""

from alembic import op
import sqlalchemy as sa

revision = "d5f8_project_team"
down_revision = "a9c3_user_roles"
branch_labels = None
depends_on = None


def upgrade():
    for name in ("start_date", "end_date", "code_freeze_date", "testing_date"):
        op.add_column("projects", sa.Column(name, sa.Date(), nullable=True))
    op.add_column(
        "projects",
        sa.Column(
            "github_repo", sa.String(length=500), nullable=False, server_default=""
        ),
    )
    op.add_column(
        "project_members",
        sa.Column(
            "role", sa.String(length=30), nullable=False, server_default="DEVELOPER"
        ),
    )
    op.execute(
        "UPDATE project_members SET role = 'LEAD' WHERE EXISTS ("
        "SELECT 1 FROM projects WHERE projects.id = project_members.project_id "
        "AND projects.owner_id = project_members.user_id)"
    )


def downgrade():
    op.drop_column("project_members", "role")
    for name in (
        "github_repo",
        "testing_date",
        "code_freeze_date",
        "end_date",
        "start_date",
    ):
        op.drop_column("projects", name)
