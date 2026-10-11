from sqlalchemy import String, Text, ForeignKey, UniqueConstraint, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base
from app.models.base import Timestamps

test_case_criteria = Table(
    "test_case_criteria",
    Base.metadata,
    Column(
        "test_case_id",
        ForeignKey("test_cases.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "criterion_id",
        ForeignKey("acceptance_criteria.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


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
    # Latest execution result, kept in sync by the executions service.
    status: Mapped[str] = mapped_column(String(20), default="NOT_RUN")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    steps = relationship(
        "TestCaseStep",
        cascade="all, delete-orphan",
        order_by="TestCaseStep.step_number",
        passive_deletes=True,
    )
    criteria = relationship("AcceptanceCriterion", secondary=test_case_criteria)
    executions = relationship(
        "TestExecution",
        back_populates="test_case",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="[TestExecution.executed_on.desc(), TestExecution.id.desc()]",
    )
    story = relationship("Issue", foreign_keys=[issue_id], overlaps="test_cases")

    @property
    def criterion_ids(self):
        return sorted(c.id for c in self.criteria)

    @property
    def last_execution(self):
        return self.executions[0] if self.executions else None

    @property
    def last_executed_on(self):
        return self.last_execution.executed_on if self.executions else None

    @property
    def execution_count(self):
        return len(self.executions)
