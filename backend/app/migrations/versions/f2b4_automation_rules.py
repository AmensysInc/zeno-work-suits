"""Automation rules."""

from alembic import op
import sqlalchemy as sa

revision = "f2b4_automation_rules"
down_revision = "e6a1_project_chat"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "automation_rules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column(
            "trigger",
            sa.String(length=40),
            nullable=False,
            server_default="STATUS_CHANGED",
        ),
        sa.Column("to_status", sa.String(length=40), nullable=False),
        sa.Column(
            "action",
            sa.String(length=40),
            nullable=False,
            server_default="NOTIFY_REPORTER",
        ),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_automation_rules_owner_id"), "automation_rules", ["owner_id"]
    )
    op.create_index(
        op.f("ix_automation_rules_project_id"), "automation_rules", ["project_id"]
    )


def downgrade():
    op.drop_index(op.f("ix_automation_rules_project_id"), table_name="automation_rules")
    op.drop_index(op.f("ix_automation_rules_owner_id"), table_name="automation_rules")
    op.drop_table("automation_rules")
