"""Project chat messages."""

from alembic import op
import sqlalchemy as sa

revision = "e6a1_project_chat"
down_revision = "d5f8_project_team"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_chat_messages_project_id"), "chat_messages", ["project_id"]
    )
    op.create_index(op.f("ix_chat_messages_user_id"), "chat_messages", ["user_id"])


def downgrade():
    op.drop_index(op.f("ix_chat_messages_user_id"), table_name="chat_messages")
    op.drop_index(op.f("ix_chat_messages_project_id"), table_name="chat_messages")
    op.drop_table("chat_messages")
