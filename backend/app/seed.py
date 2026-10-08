"""Idempotent demo data. Run after Alembic migrations."""

from datetime import date
from sqlalchemy import select
from app.db.database import SessionLocal
from app.models import (
    User,
    Project,
    Issue,
    Sprint,
    AcceptanceCriterion,
    TestCase,
    TestCaseStep,
)
from app.core.security import hash_password


def seed():
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == "alex@trackly.demo")):
            print("Demo already exists; no data changed.")
            return
        users = [
            User(
                first_name=first,
                last_name=last,
                email=email,
                password_hash=hash_password("Trackly123!"),
            )
            for first, last, email in [
                ("Alex", "Rivera", "alex@trackly.demo"),
                ("Nina", "Kim", "nina@trackly.demo"),
                ("Sam", "Patel", "sam@trackly.demo"),
            ]
        ]
        db.add_all(users)
        db.flush()
        project = Project(
            key="HRMS",
            name="Quick HRMS",
            description="Human resource management platform",
            owner_id=users[0].id,
            members=users,
            issue_counter=136,
            test_counter=4,
        )
        db.add(project)
        db.flush()
        sprint = Sprint(
            project_id=project.id,
            name="Sprint 13",
            goal="Finish Leave Management MVP",
            start_date=date(2026, 10, 19),
            end_date=date(2026, 10, 30),
            status="PLANNED",
        )
        db.add(sprint)
        db.flush()
        epic = Issue(
            project_id=project.id,
            issue_key="HRMS-100",
            issue_type="EPIC",
            summary="Leave Management",
            reporter_id=users[0].id,
            description="A simple, reliable leave experience for employees and managers.",
        )
        db.add(epic)
        db.flush()
        rows = [
            (124, "Employee can request leave", "STORY", "HIGH", 5, "IN_PROGRESS"),
            (125, "Manager can approve leave", "STORY", "HIGH", 5, "CODE_REVIEW"),
            (126, "Show leave balance", "STORY", "MEDIUM", 3, "TODO"),
            (127, "Create leave request API", "TASK", "MEDIUM", 5, "TODO"),
            (136, "Leave balance incorrect", "BUG", "CRITICAL", 3, "BACKLOG"),
            (120, "Leave types setup", "TASK", "LOW", 2, "DONE"),
        ]
        story = None
        for index, (number, summary, kind, priority, points, status) in enumerate(rows):
            issue = Issue(
                project_id=project.id,
                issue_key=f"HRMS-{number}",
                issue_type=kind,
                summary=summary,
                description=(
                    "As an employee, I want to request annual leave so that my manager can review and approve my time off."
                    if number == 124
                    else ""
                ),
                status=status,
                priority=priority,
                story_points=points,
                reporter_id=users[0].id,
                assignee_id=users[index % 3].id,
                epic_id=epic.id,
                sprint_id=None if number == 136 else sprint.id,
                order_index=index * 100,
            )
            db.add(issue)
            db.flush()
            if number == 124:
                story = issue
        for index, text in enumerate(
            [
                "Employee can select leave type",
                "Employee can select start/end date",
                "System validates leave balance",
                "Manager receives notification",
            ]
        ):
            db.add(
                AcceptanceCriterion(
                    issue_id=story.id,
                    description=text,
                    order_index=index,
                    completed=index < 2,
                )
            )
        for index, (title, status) in enumerate(
            [
                ("Submit valid annual leave", "PASSED"),
                ("Submit leave with insufficient balance", "FAILED"),
                ("Invalid date range", "NOT_RUN"),
                ("Manager notification", "PASSED"),
            ],
            1,
        ):
            tc = TestCase(
                project_id=project.id,
                issue_id=story.id,
                test_case_key=f"TC-{index:03}",
                title=title,
                status=status,
                priority="HIGH",
                preconditions="Employee is logged in and has sufficient leave balance.",
                expected_result="The request is validated and the employee sees a clear result.",
                created_by=users[0].id,
            )
            tc.steps = [
                TestCaseStep(step_number=n, action=action, expected_result=result)
                for n, (action, result) in enumerate(
                    [
                        ("Login as employee", "Dashboard displayed"),
                        ("Open Leave page", "Leave balance displayed"),
                        (
                            "Select dates and submit",
                            "Request created with Pending status",
                        ),
                    ],
                    1,
                )
            ]
            db.add(tc)
        db.commit()
        print("Seeded Quick HRMS. Demo login: alex@trackly.demo / Trackly123!")


if __name__ == "__main__":
    seed()
