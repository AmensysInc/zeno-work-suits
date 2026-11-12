"""Issue document attachments."""

from alembic import op
import sqlalchemy as sa

revision = "l6e0_issue_attachments"
down_revision = "k5d9_issue_assignees"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "issue_attachments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("issue_id", sa.Integer(), nullable=False),
        sa.Column("uploader_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["issue_id"], ["issues.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploader_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_issue_attachments_issue_id"), "issue_attachments", ["issue_id"]
    )


def downgrade():
    op.drop_index(op.f("ix_issue_attachments_issue_id"), table_name="issue_attachments")
    op.drop_table("issue_attachments")
