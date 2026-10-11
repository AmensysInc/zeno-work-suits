from sqlalchemy import String, Text, ForeignKey, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base
from app.models.base import Timestamps

project_members = Table(
    "project_members",
    Base.metadata,
    Column(
        "project_id", ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    ),
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class Project(Timestamps, Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(10), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    issue_counter: Mapped[int] = mapped_column(default=0)
    test_counter: Mapped[int] = mapped_column(default=0)
    owner = relationship("User", back_populates="projects")
    members = relationship("User", secondary=project_members)
    issues = relationship(
        "Issue",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    sprints = relationship(
        "Sprint",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
