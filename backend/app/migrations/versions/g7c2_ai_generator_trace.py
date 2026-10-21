"""AI generator traceability."""

from alembic import op
import sqlalchemy as sa

revision = "g7c2_ai_generator_trace"
down_revision = "f2b4_automation_rules"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("issues", sa.Column("ai_source", sa.JSON(), nullable=True))
    op.add_column("test_cases", sa.Column("ai_source", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("test_cases", "ai_source")
    op.drop_column("issues", "ai_source")
