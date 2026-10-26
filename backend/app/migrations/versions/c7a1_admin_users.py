"""Admin-managed users: admin/active flags, forced password change, last login."""

from alembic import op
import sqlalchemy as sa

revision = "c7a1_admin_users"
down_revision = "b4d2_qa_management"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.add_column(
        "users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true())
    )
    op.add_column(
        "users",
        sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
    # Self-registration is gone: whoever registered first becomes the administrator.
    op.execute("UPDATE users SET is_admin = true WHERE id = (SELECT MIN(id) FROM users)")


def downgrade():
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "must_change_password")
    op.drop_column("users", "is_active")
    op.drop_column("users", "is_admin")
