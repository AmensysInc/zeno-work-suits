"""Saved speech-to-text transcripts."""

from alembic import op
import sqlalchemy as sa

revision = "i3b7_voice_transcripts"
down_revision = "h1a2_merge_admin_roles"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "voice_transcripts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("languages", sa.JSON(), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_voice_transcripts_user_id"), "voice_transcripts", ["user_id"]
    )
    op.create_index(
        op.f("ix_voice_transcripts_project_id"), "voice_transcripts", ["project_id"]
    )


def downgrade():
    op.drop_index(
        op.f("ix_voice_transcripts_project_id"), table_name="voice_transcripts"
    )
    op.drop_index(op.f("ix_voice_transcripts_user_id"), table_name="voice_transcripts")
    op.drop_table("voice_transcripts")
