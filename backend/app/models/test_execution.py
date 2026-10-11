from datetime import date
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base
from app.models.base import Timestamps


class TestExecution(Timestamps, Base):
    """One run of a test case: outcome, actual result, tester and date."""

    __tablename__ = "test_executions"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    test_case_id: Mapped[int] = mapped_column(
        ForeignKey("test_cases.id", ondelete="CASCADE"), index=True
    )
    sprint_id: Mapped[int | None] = mapped_column(
        ForeignKey("sprints.id", ondelete="SET NULL"), index=True
    )
    status: Mapped[str] = mapped_column(String(20))
    actual_result: Mapped[str] = mapped_column(Text, default="")
    environment: Mapped[str] = mapped_column(String(100), default="")
    tester_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    executed_on: Mapped[date]
    test_case = relationship("TestCase", back_populates="executions")
    tester = relationship("User")
    steps = relationship(
        "TestExecutionStep",
        cascade="all, delete-orphan",
        order_by="TestExecutionStep.step_number",
        passive_deletes=True,
    )

    @property
    def test_case_key(self):
        return self.test_case.test_case_key

    @property
    def test_case_title(self):
        return self.test_case.title

    @property
    def issue_id(self):
        return self.test_case.issue_id


class TestExecutionStep(Base):
    """Per-step result; the step text is a snapshot taken when the run is recorded."""

    __tablename__ = "test_execution_steps"
    id: Mapped[int] = mapped_column(primary_key=True)
    execution_id: Mapped[int] = mapped_column(
        ForeignKey("test_executions.id", ondelete="CASCADE"), index=True
    )
    step_number: Mapped[int]
    action: Mapped[str] = mapped_column(Text)
    test_data: Mapped[str] = mapped_column(Text, default="")
    expected_result: Mapped[str] = mapped_column(Text, default="")
    actual_result: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="NOT_RUN")
