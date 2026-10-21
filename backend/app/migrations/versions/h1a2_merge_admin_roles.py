"""Join admin-managed users with workspace roles: role is the only admin flag."""

from alembic import op
import sqlalchemy as sa

revision = "h1a2_merge_admin_roles"
down_revision = ("c7a1_admin_users", "g7c2_ai_generator_trace")
branch_labels = None
depends_on = None


def upgrade():
    # Anyone made an administrator through the admin console keeps that access.
    op.execute("UPDATE users SET role = 'ADMIN' WHERE is_admin")
    op.drop_column("users", "is_admin")


def downgrade():
    op.add_column(
        "users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.execute("UPDATE users SET is_admin = true WHERE role = 'ADMIN'")
