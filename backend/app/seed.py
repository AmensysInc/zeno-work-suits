"""Idempotent demo data. Run after Alembic migrations."""

from datetime import date, timedelta
from sqlalchemy import select, update
from app.db.database import SessionLocal
from app.models.project import project_members
from app.models import (
    User,
    Project,
    Issue,
    Sprint,
    AcceptanceCriterion,
    SharedStep,
    TestCase,
    TestCaseStep,
    TestExecution,
    TestExecutionStep,
)
from app.core.security import hash_password


def seed_qa(db):
    """Adds QA demo data to Quick HRMS once; safe to run on an existing demo."""
    project = db.scalar(select(Project).where(Project.key == "HRMS"))
    if not project or db.scalar(
        select(SharedStep.id).where(SharedStep.project_id == project.id)
    ):
        return False
    users = {u.email.split("@")[0]: u for u in project.members}
    story = db.scalar(select(Issue).where(Issue.issue_key == "HRMS-124"))
    # Only the four demo tests; never touch test cases people added themselves.
    tests = {
        t.test_case_key: t
        for t in db.scalars(
            select(TestCase).where(
                TestCase.issue_id == story.id,
                TestCase.test_case_key.in_(["TC-001", "TC-002", "TC-003", "TC-004"]),
                TestCase.created_by == users["alex"].id,
            )
        )
    }
    if len(tests) != 4:
        return False
    criteria = db.scalars(
        select(AcceptanceCriterion)
        .where(AcceptanceCriterion.issue_id == story.id)
        .order_by(AcceptanceCriterion.order_index)
    ).all()
    sprint = db.scalar(
        select(Sprint)
        .where(Sprint.project_id == project.id, Sprint.status != "COMPLETED")
        .order_by(Sprint.id.desc())
    )
    login, leave_page = (
        SharedStep(
            project_id=project.id,
            title=title,
            action=action,
            test_data=data,
            expected_result=result,
            created_by=users["alex"].id,
        )
        for title, action, data, result in [
            (
                "Sign in as employee",
                "Login as employee",
                "nina@trackly.demo / Trackly123!",
                "Dashboard displayed",
            ),
            (
                "Open the Leave page",
                "Open Leave page",
                "",
                "Leave balance displayed",
            ),
        ]
    )
    db.add_all([login, leave_page])
    db.flush()
    submit_data = {
        "TC-001": "Annual leave, 2026-11-02 to 2026-11-04, balance 12 days",
        "TC-002": "Annual leave, 2026-11-02 to 2026-11-20, balance 3 days",
        "TC-003": "Annual leave, end date 2026-11-01 before start 2026-11-05",
        "TC-004": "Annual leave, 2026-11-10, manager sam@trackly.demo",
    }
    coverage = {"TC-001": [0, 1], "TC-002": [2], "TC-003": [1], "TC-004": [3]}
    for key, tc in tests.items():
        for step in tc.steps:
            shared = {1: login, 2: leave_page}.get(step.step_number)
            if shared:
                step.shared_step_id = shared.id
                step.test_data = shared.test_data
            else:
                step.test_data = submit_data.get(key, "")
        tc.criteria = [criteria[i] for i in coverage.get(key, [])]
    db.flush()
    today = date.today()
    runs = [
        ("TC-001", "BLOCKED", "nina", 4, "Leave page returned 503 in staging.", 2),
        ("TC-001", "PASSED", "nina", 2, "Request created as Pending.", None),
        (
            "TC-002",
            "FAILED",
            "sam",
            1,
            "Request was submitted although balance was only 3 days.",
            3,
        ),
        ("TC-004", "PASSED", "sam", 1, "Manager received the email.", None),
    ]
    failed_run = None
    for key, status, tester, days_ago, actual, broken_step in runs:
        tc = tests[key]
        run = TestExecution(
            project_id=project.id,
            test_case_id=tc.id,
            sprint_id=sprint and sprint.id,
            status=status,
            actual_result=actual,
            environment="Staging",
            tester_id=users[tester].id,
            executed_on=today - timedelta(days=days_ago),
        )
        run.steps = [
            TestExecutionStep(
                step_number=s.step_number,
                action=s.action,
                test_data=s.test_data,
                expected_result=s.expected_result,
                status=(
                    "PASSED"
                    if broken_step is None or s.step_number < broken_step
                    else status if s.step_number == broken_step else "NOT_RUN"
                ),
                actual_result=actual if s.step_number == broken_step else "",
            )
            for s in tc.steps
        ]
        db.add(run)
        db.flush()
        tc.status = status
        if status == "FAILED":
            failed_run = run
    bug = db.scalar(select(Issue).where(Issue.issue_key == "HRMS-136"))
    if bug and failed_run and not bug.related_test_case_id:
        bug.related_issue_id = story.id
        bug.related_test_case_id = failed_run.test_case_id
        bug.related_execution_id = failed_run.id
        bug.description = bug.description or (
            "Found by TC-002. Submitting 18 days with a 3-day balance succeeds "
            "instead of showing an insufficient balance error."
        )
    for summary, status, assignee in [
        ("Build leave request form", "DONE", "nina"),
        ("Leave request API endpoint", "IN_PROGRESS", "sam"),
        ("Balance validation rule", "TODO", "sam"),
    ]:
        project.issue_counter += 1
        db.add(
            Issue(
                project_id=project.id,
                issue_key=f"HRMS-{project.issue_counter}",
                issue_type="SUBTASK",
                summary=summary,
                status=status,
                priority="MEDIUM",
                reporter_id=users["alex"].id,
                assignee_id=users[assignee].id,
                parent_issue_id=story.id,
                epic_id=story.epic_id,
                sprint_id=story.sprint_id,
            )
        )
    db.commit()
    return True


DEMO_ROLES = {
    "alex@trackly.demo": "ADMIN",
    "sam@trackly.demo": "MANAGER",
    "nina@trackly.demo": "EMPLOYEE",
}


def ensure_demo_roles(db):
    changed = False
    for email, role in DEMO_ROLES.items():
        user = db.scalar(select(User).where(User.email == email))
        if user and user.role != role:
            user.role = role
            changed = True
    if changed:
        db.commit()
    return changed


def seed():
    with SessionLocal() as db:
        ensure_demo_roles(db)
        if db.scalar(select(User).where(User.email == "alex@trackly.demo")):
            print(
                "Added QA demo data."
                if seed_qa(db)
                else "Demo already exists; no data changed."
            )
            return
        users = [
            User(
                first_name=first,
                last_name=last,
                email=email,
                password_hash=hash_password("Trackly123!"),
                role=DEMO_ROLES[email],
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
        for user, role in zip(users, ("LEAD", "TESTER", "DEVELOPER")):
            db.execute(
                update(project_members)
                .where(
                    project_members.c.project_id == project.id,
                    project_members.c.user_id == user.id,
                )
                .values(role=role)
            )
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
        seed_qa(db)
        print("Seeded Quick HRMS. Demo login: alex@trackly.demo / Trackly123!")


if __name__ == "__main__":
    seed()
