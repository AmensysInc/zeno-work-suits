from sqlalchemy import String, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base
from app.models.base import Timestamps


class TestCase(Timestamps, Base):
    __tablename__ = "test_cases"
    __table_args__ = (UniqueConstraint("project_id", "test_case_key"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    issue_id: Mapped[int] = mapped_column(
        ForeignKey("issues.id", ondelete="CASCADE"), index=True
    )
    test_case_key: Mapped[str] = mapped_column(String(30))
    title: Mapped[str] = mapped_column(String(300))
    test_type: Mapped[str] = mapped_column(String(20), default="FUNCTIONAL")
    priority: Mapped[str] = mapped_column(String(20), default="MEDIUM")
    preconditions: Mapped[str] = mapped_column(Text, default="")
    expected_result: Mapped[str] = mapped_column(Text, default="")
    test_data: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="NOT_RUN")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    steps = relationship(
        "TestCaseStep",
        cascade="all, delete-orphan",
        order_by="TestCaseStep.step_number",
        passive_deletes=True,
    )
    story = relationship("Issue", foreign_keys=[issue_id], overlaps="test_cases")
