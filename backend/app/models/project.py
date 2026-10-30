from datetime import date
from sqlalchemy import Date, String, Text, ForeignKey, Table, Column, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base
from app.models.base import Timestamps

PROJECT_ROLES = (
    "LEAD",
    "DEVELOPER",
    "DESIGNER",
    "TESTER",
    "BUSINESS_ANALYST",
    "DEVOPS",
)

project_members = Table(
    "project_members",
    Base.metadata,
    Column(
        "project_id", ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    ),
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column(
        "role",
        String(30),
        nullable=False,
        default="DEVELOPER",
        server_default="DEVELOPER",
    ),
)


class ProjectMember(Base):
    __table__ = project_members
    user = relationship("User", viewonly=True)


class ProjectRepository(Timestamps, Base):
    """A GitHub repository linked to a project; a project can link several."""

    __tablename__ = "project_repositories"
    __table_args__ = (UniqueConstraint("project_id", "full_name"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    # "owner/name" exactly as GitHub spells it.
    full_name: Mapped[str] = mapped_column(String(200))
    html_url: Mapped[str] = mapped_column(String(500))


class Project(Timestamps, Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(10), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")
    # SCRUM boards show the active sprint; KANBAN boards show all work in flow.
    board_type: Mapped[str] = mapped_column(String(20), default="SCRUM")
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    code_freeze_date: Mapped[date | None] = mapped_column(Date)
    testing_date: Mapped[date | None] = mapped_column(Date)
    # The first linked repository, kept for older clients; `repositories` holds them all.
    github_repo: Mapped[str] = mapped_column(String(500), default="")
    issue_counter: Mapped[int] = mapped_column(default=0)
    test_counter: Mapped[int] = mapped_column(default=0)
    owner = relationship("User", back_populates="projects")
    repositories = relationship(
        "ProjectRepository",
        order_by="ProjectRepository.id",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )
    members = relationship("User", secondary=project_members, overlaps="team")
    team = relationship(
        "ProjectMember",
        viewonly=True,
        order_by=project_members.c.user_id,
    )
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
