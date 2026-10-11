from fastapi import HTTPException
from app.models import Comment
from app.services.access import issue_access, child_access
from app.services.activity import record


def owned(db, id, actor):
    comment = child_access(db, Comment, id, actor)
    if comment.user_id != actor.id:
        raise HTTPException(403, "You can only edit or delete your own comments")
    return comment


def create(db, actor, issue_id, data):
    issue = issue_access(db, issue_id, actor)
    comment = Comment(issue_id=issue_id, user_id=actor.id, body=data.body)
    db.add(comment)
    record(db, actor, issue.project_id, issue.id, "added comment")
    db.commit()
    return comment


def edit(db, actor, id, data):
    comment = owned(db, id, actor)
    comment.body = data.body
    db.commit()
    return comment
