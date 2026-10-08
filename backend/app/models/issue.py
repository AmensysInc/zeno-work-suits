from datetime import date
from sqlalchemy import String, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base
from app.models.base import Timestamps


class Issue(Timestamps, Base):
    __tablename__ = "issues"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    issue_key: Mapped[str] = mapped_column(String(30), unique=True)
    issue_type: Mapped[str] = mapped_column(String(20))
    summary: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="BACKLOG")
    priority: Mapped[str] = mapped_column(String(20), default="MEDIUM")
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    parent_issue_id: Mapped[int | None] = mapped_column(
        ForeignKey("issues.id", ondelete="SET NULL")
    )
    epic_id: Mapped[int | None] = mapped_column(
        ForeignKey("issues.id", ondelete="SET NULL")
    )
    sprint_id: Mapped[int | None] = mapped_column(
        ForeignKey("sprints.id", ondelete="SET NULL")
    )
    related_issue_id: Mapped[int | None] = mapped_column(
        ForeignKey("issues.id", ondelete="SET NULL")
    )
    related_test_case_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "test_cases.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_issue_related_test",
        )
    )
    story_points: Mapped[int] = mapped_column(default=0)
    order_index: Mapped[float] = mapped_column(default=0)
    labels: Mapped[list] = mapped_column(JSON, default=list)
    start_date: Mapped[date | None]
    due_date: Mapped[date | None]
    project = relationship("Project", back_populates="issues")
    assignee = relationship("User", foreign_keys=[assignee_id])
    reporter = relationship("User", foreign_keys=[reporter_id])
    parent = relationship("Issue", remote_side=[id], foreign_keys=[parent_issue_id])
    epic = relationship("Issue", remote_side=[id], foreign_keys=[epic_id])
    sprint = relationship("Sprint", back_populates="issues")
    acceptance_criteria = relationship(
        "AcceptanceCriterion", cascade="all, delete-orphan", passive_deletes=True
    )
    test_cases = relationship(
        "TestCase",
        foreign_keys="TestCase.issue_id",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    comments = relationship(
        "Comment", cascade="all, delete-orphan", passive_deletes=True
    )
