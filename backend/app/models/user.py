from datetime import datetime
from sqlalchemy import Boolean, DateTime, String, false, true
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base
from app.models.base import Timestamps


ROLES = ("ADMIN", "MANAGER", "EMPLOYEE")


class User(Timestamps, Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[str] = mapped_column(String(80))
    last_name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    # ADMIN sees every project. MANAGER runs projects they own. EMPLOYEE works inside them.
    role: Mapped[str] = mapped_column(String(20), default="EMPLOYEE")
    avatar_url: Mapped[str | None] = mapped_column(String(1000))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    # Set when an admin issues a temporary password; the user must pick their own on next sign-in.
    must_change_password: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false()
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    projects = relationship("Project", back_populates="owner")

    @property
    def is_admin(self) -> bool:
        # Accounts are created by admins only. Admins manage users and can open every project.
        return self.role == "ADMIN"
