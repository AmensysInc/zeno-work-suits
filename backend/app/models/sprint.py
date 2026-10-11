from datetime import date
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base
from app.models.base import Timestamps


class Sprint(Timestamps, Base):
    __tablename__ = "sprints"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    goal: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="PLANNED")
    start_date: Mapped[date | None]
    end_date: Mapped[date | None]
    capacity: Mapped[int] = mapped_column(default=30)
    project = relationship("Project", back_populates="sprints")
    issues = relationship("Issue", back_populates="sprint", passive_deletes=True)
