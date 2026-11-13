"""Calendar meetings and their attendees."""

from alembic import op
import sqlalchemy as sa

revision = "m7f1_meetings"
down_revision = "l6e0_issue_attachments"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "meetings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("organizer_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organizer_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_meetings_starts_at", "meetings", ["starts_at"])
    op.create_index("ix_meetings_ends_at", "meetings", ["ends_at"])
    op.create_index("ix_meetings_organizer_id", "meetings", ["organizer_id"])
    op.create_index("ix_meetings_project_id", "meetings", ["project_id"])
    op.create_table(
        "meeting_attendees",
        sa.Column("meeting_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("meeting_id", "user_id"),
    )
    op.create_index("ix_meeting_attendees_user_id", "meeting_attendees", ["user_id"])


def downgrade():
    op.drop_index("ix_meeting_attendees_user_id", table_name="meeting_attendees")
    op.drop_table("meeting_attendees")
    for name in ("project_id", "organizer_id", "ends_at", "starts_at"):
        op.drop_index(f"ix_meetings_{name}", table_name="meetings")
    op.drop_table("meetings")
