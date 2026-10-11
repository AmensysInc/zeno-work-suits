from app.models import ActivityLog


def record(db, actor, project_id, issue_id, action, field=None, old=None, new=None):
    db.add(
        ActivityLog(
            user_id=actor.id,
            project_id=project_id,
            issue_id=issue_id,
            action=action,
            field_name=field,
            old_value=None if old is None else str(old),
            new_value=None if new is None else str(new),
        )
    )
