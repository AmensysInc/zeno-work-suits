from datetime import date, datetime
from sqlalchemy import JSON, Column, Date, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base
from app.models.base import Timestamps, now

# People invited to a meeting (the organizer is not listed here).
meeting_attendees = Table(
    "meeting_attendees",
    Base.metadata,
    Column("meeting_id", Integer, ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True),
)

REPEATS = ("DAILY", "WEEKDAYS", "WEEKLY", "BIWEEKLY", "MONTHLY")


class Meeting(Timestamps, Base):
    """A scheduled meeting on the Calendar; each one has its own video call room.

    A repeating meeting is stored as one row per occurrence sharing a series_id,
    so each occurrence keeps its own call, chat and transcripts.
    """

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
    series_id: Mapped[str | None] = mapped_column(String(36), index=True)
    repeat: Mapped[str | None] = mapped_column(String(20))
    repeat_until: Mapped[date | None] = mapped_column(Date)
    organizer = relationship("User", foreign_keys=[organizer_id])
    project = relationship("Project")
    attendees = relationship("User", secondary=meeting_attendees, order_by="User.first_name")


class MeetingMessage(Timestamps, Base):
    """A message in a meeting's own chat."""

    __tablename__ = "meeting_messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    user = relationship("User")


class CallTranscript(Base):
    """A Soniox transcript of a call, recorded by one person's browser.

    Belongs to a meeting (shown in its chat) or to a project call (shown in the
    project chat). The text is saved as the recording goes, so a closed tab
    still leaves what was said up to then.
    """

    __tablename__ = "call_transcripts"
    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int | None] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), index=True
    )
    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20), default="RECORDING")
    text: Mapped[str] = mapped_column(Text, default="")
    languages: Mapped[list] = mapped_column(JSON, default=list)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user = relationship("User")
