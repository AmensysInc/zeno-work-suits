from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base
from app.models.base import Timestamps

# People invited to a meeting (the organizer is not listed here).
meeting_attendees = Table(
    "meeting_attendees",
    Base.metadata,
    Column("meeting_id", Integer, ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True),
)


class Meeting(Timestamps, Base):
    """A scheduled meeting on the Calendar; each one has its own video call room."""

    __tablename__ = "meetings"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    organizer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # Optional tag; the meeting stays when the project is deleted.
    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), index=True
    )
    organizer = relationship("User", foreign_keys=[organizer_id])
    project = relationship("Project")
    attendees = relationship("User", secondary=meeting_attendees, order_by="User.first_name")
