"""Project management: Scrum or Kanban board per project."""

from alembic import op
import sqlalchemy as sa

revision = "c7e1_project_board_type"
down_revision = "b4d2_qa_management"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "projects",
        sa.Column(
            "board_type", sa.String(length=20), nullable=False, server_default="SCRUM"
        ),
    )


def downgrade():
    op.drop_column("projects", "board_type")
