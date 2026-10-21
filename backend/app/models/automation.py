from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base
from app.models.base import Timestamps


class AutomationRule(Timestamps, Base):
    __tablename__ = "automation_rules"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    trigger: Mapped[str] = mapped_column(String(40), default="STATUS_CHANGED")
    to_status: Mapped[str] = mapped_column(String(40))
    action: Mapped[str] = mapped_column(String(40), default="NOTIFY_REPORTER")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    owner = relationship("User")
    project = relationship("Project")
