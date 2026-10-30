"""Projects can link several GitHub repositories; the old single link moves over."""

import re
from alembic import op
import sqlalchemy as sa

revision = "j4c8_project_repositories"
down_revision = "i3b7_voice_transcripts"
branch_labels = None
depends_on = None

REPO_URL = re.compile(r"^https://github\.com/([\w.-]+)/([\w.-]+?)(?:\.git)?/?$")


def upgrade():
    repos = op.create_table(
        "project_repositories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("html_url", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "full_name"),
    )
    op.create_index(
        op.f("ix_project_repositories_project_id"),
        "project_repositories",
        ["project_id"],
    )
    # Every project keeps the repository it already had.
    projects = op.get_bind().execute(
        sa.text(
            "SELECT id, github_repo, created_at FROM projects WHERE github_repo <> ''"
        )
    )
    rows = []
    for project_id, url, created in projects:
        match = REPO_URL.match(url.strip())
        if match:
            rows.append(
                {
                    "project_id": project_id,
                    "full_name": f"{match[1]}/{match[2]}",
                    "html_url": url.strip(),
                    "created_at": created,
                    "updated_at": created,
                }
            )
    if rows:
        op.bulk_insert(repos, rows)


def downgrade():
    op.drop_index(
        op.f("ix_project_repositories_project_id"), table_name="project_repositories"
    )
    op.drop_table("project_repositories")
