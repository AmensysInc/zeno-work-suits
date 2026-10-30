from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base
from app.models.base import Timestamps


class VoiceTranscript(Timestamps, Base):
    """A saved speech-to-text transcript; private to the person who recorded it."""

    __tablename__ = "voice_transcripts"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    text: Mapped[str] = mapped_column(Text)
    # Language codes heard in the recording, e.g. ["en", "te"].
    languages: Mapped[list] = mapped_column(JSON, default=list)
    duration_seconds: Mapped[int] = mapped_column(default=0)
    project = relationship("Project")
