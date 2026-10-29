"""QA management: reusable steps, criteria coverage, test executions."""

from alembic import op
import sqlalchemy as sa

revision = "b4d2_qa_management"
down_revision = "8f21_linked_test_fk"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "shared_steps",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("test_data", sa.Text(), nullable=False),
        sa.Column("expected_result", sa.Text(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_shared_steps_project_id"), "shared_steps", ["project_id"])
    op.add_column(
        "test_case_steps",
        sa.Column("test_data", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "test_case_steps", sa.Column("shared_step_id", sa.Integer(), nullable=True)
    )
    op.create_index(
        op.f("ix_test_case_steps_shared_step_id"),
        "test_case_steps",
        ["shared_step_id"],
    )
    op.create_foreign_key(
        "fk_test_case_steps_shared_step",
        "test_case_steps",
        "shared_steps",
        ["shared_step_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_table(
        "test_case_criteria",
        sa.Column("test_case_id", sa.Integer(), nullable=False),
        sa.Column("criterion_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["test_case_id"], ["test_cases.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["criterion_id"], ["acceptance_criteria.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("test_case_id", "criterion_id"),
    )
    op.create_table(
        "test_executions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("test_case_id", sa.Integer(), nullable=False),
        sa.Column("sprint_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("actual_result", sa.Text(), nullable=False),
        sa.Column("environment", sa.String(length=100), nullable=False),
        sa.Column("tester_id", sa.Integer(), nullable=False),
        sa.Column("executed_on", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["test_case_id"], ["test_cases.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["sprint_id"], ["sprints.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["tester_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("project_id", "test_case_id", "sprint_id"):
        op.create_index(
            op.f(f"ix_test_executions_{column}"), "test_executions", [column]
        )
    op.create_table(
        "test_execution_steps",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("execution_id", sa.Integer(), nullable=False),
        sa.Column("step_number", sa.Integer(), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("test_data", sa.Text(), nullable=False),
        sa.Column("expected_result", sa.Text(), nullable=False),
        sa.Column("actual_result", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(
            ["execution_id"], ["test_executions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_test_execution_steps_execution_id"),
        "test_execution_steps",
        ["execution_id"],
    )
    op.add_column(
        "issues", sa.Column("related_execution_id", sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        "fk_issue_related_execution",
        "issues",
        "test_executions",
        ["related_execution_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade():
    op.drop_constraint("fk_issue_related_execution", "issues", type_="foreignkey")
    op.drop_column("issues", "related_execution_id")
    op.drop_table("test_execution_steps")
    op.drop_table("test_executions")
    op.drop_table("test_case_criteria")
    op.drop_constraint(
        "fk_test_case_steps_shared_step", "test_case_steps", type_="foreignkey"
    )
    op.drop_index(
        op.f("ix_test_case_steps_shared_step_id"), table_name="test_case_steps"
    )
    op.drop_column("test_case_steps", "shared_step_id")
    op.drop_column("test_case_steps", "test_data")
    op.drop_table("shared_steps")
