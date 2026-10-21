from fastapi import APIRouter
from app.api.deps import DB, Actor
from app.schemas.report import ProjectReport
from app.services import reports

router = APIRouter(tags=["Reports"])


@router.get("/projects/{project_id}/reports", response_model=ProjectReport)
def project_report(
    project_id: int, db: DB, actor: Actor, sprint_id: int | None = None
):
    """Delivery metrics: velocity, burndown, workload and throughput."""
    return reports.project_report(db, project_id, actor, sprint_id)
