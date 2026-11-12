"""Multiple assignees per issue."""

from alembic import op
import sqlalchemy as sa

revision = "k5d9_issue_assignees"
down_revision = "j4c8_project_repositories"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "issue_assignees",
        sa.Column("issue_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["issue_id"], ["issues.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("issue_id", "user_id"),
    )
    op.create_index("ix_issue_assignees_user_id", "issue_assignees", ["user_id"])
    # Keep existing single assignees as the first (primary) multi-assignee.
    op.execute(
        """
        INSERT INTO issue_assignees (issue_id, user_id)
        SELECT id, assignee_id FROM issues WHERE assignee_id IS NOT NULL
        """
    )


def downgrade():
    op.drop_index("ix_issue_assignees_user_id", table_name="issue_assignees")
    op.drop_table("issue_assignees")
