from sqlalchemy import Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base


class TestCaseStep(Base):
    __tablename__ = "test_case_steps"
    id: Mapped[int] = mapped_column(primary_key=True)
    test_case_id: Mapped[int] = mapped_column(
        ForeignKey("test_cases.id", ondelete="CASCADE"), index=True
    )
    step_number: Mapped[int]
    action: Mapped[str] = mapped_column(Text)
    test_data: Mapped[str] = mapped_column(Text, default="")
    expected_result: Mapped[str] = mapped_column(Text, default="")
    shared_step_id: Mapped[int | None] = mapped_column(
        ForeignKey("shared_steps.id", ondelete="SET NULL"), index=True
    )
    shared_step = relationship("SharedStep", back_populates="usages")
