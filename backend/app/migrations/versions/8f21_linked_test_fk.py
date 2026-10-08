"""Create the circular issue-to-test link after both tables exist."""

from alembic import op

revision = "8f21_linked_test_fk"
down_revision = "57bb261778d8"
branch_labels = None
depends_on = None


def upgrade():
    op.create_foreign_key(
        "fk_issue_related_test",
        "issues",
        "test_cases",
        ["related_test_case_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade():
    op.drop_constraint("fk_issue_related_test", "issues", type_="foreignkey")
