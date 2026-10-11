from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base
from app.models.base import Timestamps


class SharedStep(Timestamps, Base):
    """A reusable test step; edits propagate to every test case step using it."""

    __tablename__ = "shared_steps"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    action: Mapped[str] = mapped_column(Text)
    test_data: Mapped[str] = mapped_column(Text, default="")
    expected_result: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    usages = relationship("TestCaseStep", back_populates="shared_step")

    @property
    def usage_count(self):
        return len({s.test_case_id for s in self.usages})
