"""Repeating meetings, meeting chat and call transcripts."""

from alembic import op
import sqlalchemy as sa

revision = "o9h3_meeting_series_chat"
down_revision = "n8g2_notifications"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("meetings", sa.Column("series_id", sa.String(length=36), nullable=True))
    op.add_column("meetings", sa.Column("repeat", sa.String(length=20), nullable=True))
    op.add_column("meetings", sa.Column("repeat_until", sa.Date(), nullable=True))
    op.create_index("ix_meetings_series_id", "meetings", ["series_id"])

    op.create_table(
        "meeting_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("meeting_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_meeting_messages_meeting_id", "meeting_messages", ["meeting_id"])

    op.create_table(
        "call_transcripts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("meeting_id", sa.Integer(), nullable=True),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("text", sa.Text(), nullable=False, server_default=""),
        sa.Column("languages", sa.JSON(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_call_transcripts_meeting_id", "call_transcripts", ["meeting_id"])
    op.create_index("ix_call_transcripts_project_id", "call_transcripts", ["project_id"])


def downgrade():
    op.drop_index("ix_call_transcripts_project_id", table_name="call_transcripts")
    op.drop_index("ix_call_transcripts_meeting_id", table_name="call_transcripts")
    op.drop_table("call_transcripts")
    op.drop_index("ix_meeting_messages_meeting_id", table_name="meeting_messages")
    op.drop_table("meeting_messages")
    op.drop_index("ix_meetings_series_id", table_name="meetings")
    op.drop_column("meetings", "repeat_until")
    op.drop_column("meetings", "repeat")
    op.drop_column("meetings", "series_id")
