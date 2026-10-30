import re
from urllib.parse import quote
import httpx
from fastapi import HTTPException
from sqlalchemy import select
from app.core.config import settings
from app.models import Project, ProjectRepository
from app.services.access import (
    can_lead,
    can_manage_project,
    is_admin,
    project_access,
    visible_projects,
)

GITHUB_API = "https://api.github.com"
REPO_URL = re.compile(r"^https://github\.com/([\w.-]+)/([\w.-]+?)(?:\.git)?/?$")
MAX_REPO_PAGES = 5


def _send(method, url, **kwargs):
    return httpx.request(method, url, timeout=30, **kwargs)


def _message(response):
    try:
        body = response.json()
    except ValueError:
        return ""
    details = [e.get("message") for e in body.get("errors", []) if isinstance(e, dict)]
    return "; ".join(m for m in [body.get("message"), *details] if m)


def call(method, path, **kwargs):
    """Calls GitHub with the server-side token; the token never reaches the browser."""
    if not settings.github_token:
        raise HTTPException(503, "GitHub is not connected: set GITHUB_TOKEN")
    try:
        response = _send(
            method,
            f"{GITHUB_API}{path}",
            headers={
                "Authorization": f"Bearer {settings.github_token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            **kwargs,
        )
    except httpx.HTTPError:
        raise HTTPException(502, "Could not reach GitHub. Please try again.")
    status = response.status_code
    if status == 401:
        raise HTTPException(502, "GitHub rejected the token (bad credentials)")
    if status == 403:
        raise HTTPException(
            403, _message(response) or "The GitHub token is not allowed to do this"
        )
    if status == 404:
        raise HTTPException(
            404, "Not found on GitHub, or the token cannot access this repository"
        )
    if status in (405, 409):
        raise HTTPException(409, _message(response) or "GitHub refused the change")
    if status == 422:
        raise HTTPException(422, _message(response) or "GitHub rejected the request")
    if status >= 400:
        raise HTTPException(502, f"GitHub error {status}")
    return response.json() if response.content else {}


def repo_name(url):
    match = REPO_URL.match(url or "")
    return f"{match[1]}/{match[2]}" if match else None


def can_merge(db, actor, project):
    """Admins, managers who own the project, and the project's leads can merge."""
    return can_lead(db, actor, project)


def pick_repo(project, repo=None):
    """One of the project's linked repositories: `repo` ("owner/name"), else the first."""
    if not project.repositories:
        raise HTTPException(409, "This project has no linked GitHub repository")
    if not repo:
        return project.repositories[0].full_name
    for linked in project.repositories:
        if linked.full_name.lower() == repo.lower():
            return linked.full_name
    raise HTTPException(404, "That repository is not linked to this project")


def linked_repo(db, project_id, actor, repo=None):
    project = project_access(db, project_id, actor)
    return project, pick_repo(project, repo)


def sync_primary(project):
    """Keeps the legacy single-repository field pointing at the first linked one."""
    project.github_repo = (
        project.repositories[0].html_url if project.repositories else ""
    )


def add_repository(project, full_name, html_url):
    """Links a repository unless the project already has it; returns whether it was added."""
    if any(r.full_name.lower() == full_name.lower() for r in project.repositories):
        return False
    project.repositories.append(
        ProjectRepository(full_name=full_name, html_url=html_url)
    )
    sync_primary(project)
    return True


def _owner_allowed(full_name):
    owners = {o.lower() for o in settings.github_allowed_owners}
    return not owners or full_name.split("/")[0].lower() in owners


def _taken(db, actor):
    """Repositories (lowercase) linked to projects this person does not manage."""
    if is_admin(actor):
        return set()
    return {
        r.full_name.lower()
        for p in db.scalars(select(Project).where(Project.repositories.any()))
        if not can_manage_project(actor, p)
        for r in p.repositories
    }


def list_repos(db, actor):
    if actor.role not in ("ADMIN", "MANAGER"):
        raise HTTPException(403, "Only an admin or a manager can link repositories")
    linked = {}
    for p in db.scalars(visible_projects(actor).where(Project.repositories.any())):
        for r in p.repositories:
            linked.setdefault(r.full_name.lower(), []).append(p.name)
    taken = _taken(db, actor)
    repos = []
    for page in range(1, MAX_REPO_PAGES + 1):
        batch = call(
            "GET",
            "/user/repos",
            params={"per_page": 100, "page": page, "sort": "updated"},
        )
        repos += batch
        if len(batch) < 100:
            break
    return [
        {
            "full_name": r["full_name"],
            "html_url": r["html_url"],
            "description": r.get("description") or "",
            "private": r.get("private", False),
            "default_branch": r.get("default_branch") or "main",
            "linked_projects": linked.get(r["full_name"].lower(), []),
        }
        for r in repos
        # Managers only see repositories they may link (see link()).
        if _owner_allowed(r["full_name"]) and r["full_name"].lower() not in taken
    ]


def link(db, project_id, full_name, actor):
    project = project_access(db, project_id, actor, owner=True)
    if not _owner_allowed(full_name):
        raise HTTPException(
            403, "Only repositories of the allowed GitHub organizations can be linked"
        )
    if full_name.lower() in _taken(db, actor):
        raise HTTPException(
            403,
            "This repository belongs to another team's project; ask an admin to link it",
        )
    if any(r.full_name.lower() == full_name.lower() for r in project.repositories):
        return project  # Already linked; nothing to ask GitHub.
    repo = call("GET", f"/repos/{full_name}")
    # Linking adds to the project's repositories; the ones already there stay.
    add_repository(project, repo["full_name"], repo["html_url"])
    db.commit()
    db.refresh(project)
    return project


def unlink(db, project_id, repo, actor):
    """Removes one linked repository; `repo` may be left out when only one is linked."""
    project = project_access(db, project_id, actor, owner=True)
    if not repo and len(project.repositories) > 1:
        raise HTTPException(422, "Choose which repository to unlink")
    name = pick_repo(project, repo)
    project.repositories = [r for r in project.repositories if r.full_name != name]
    sync_primary(project)
    db.commit()
    db.refresh(project)
    return project


def branches(db, project_id, actor, repo=None):
    project, name = linked_repo(db, project_id, actor, repo)
    repo = call("GET", f"/repos/{name}")
    items = call("GET", f"/repos/{name}/branches", params={"per_page": 100})
    return {
        "repository": name,
        "html_url": repo["html_url"],
        "default_branch": repo.get("default_branch") or "main",
        "can_merge": can_merge(db, actor, project),
        "branches": [
            {
                "name": b["name"],
                "sha": b["commit"]["sha"],
                "protected": b.get("protected", False),
            }
            for b in items
        ],
    }


def create_branch(db, project_id, data, actor, repo=None):
    _, name = linked_repo(db, project_id, actor, repo)
    base = call("GET", f"/repos/{name}/git/ref/heads/{quote(data.from_branch)}")
    sha = base["object"]["sha"]
    call(
        "POST",
        f"/repos/{name}/git/refs",
        json={"ref": f"refs/heads/{data.name}", "sha": sha},
    )
    return {"name": data.name, "sha": sha, "protected": False}


def _pull(p):
    return {
        "number": p["number"],
        "title": p["title"],
        "state": "merged" if p.get("merged_at") else p["state"],
        "draft": p.get("draft", False),
        "head": p["head"]["ref"],
        "base": p["base"]["ref"],
        "author": (p.get("user") or {}).get("login", ""),
        "html_url": p["html_url"],
        "created_at": p["created_at"],
        "updated_at": p["updated_at"],
    }


def pulls(db, project_id, state, actor, repo=None):
    _, name = linked_repo(db, project_id, actor, repo)
    items = call(
        "GET",
        f"/repos/{name}/pulls",
        params={
            "state": state,
            "per_page": 50,
            "sort": "updated",
            "direction": "desc",
        },
    )
    return [_pull(p) for p in items]


def _commit(c):
    commit = c["commit"]
    author = commit.get("author") or {}
    return {
        "sha": c["sha"],
        "message": commit["message"].split("\n", 1)[0],
        "author": (c.get("author") or {}).get("login") or author.get("name", ""),
        "date": author.get("date", ""),
        "html_url": c["html_url"],
    }


def commits(db, project_id, branch, actor, repo=None):
    """The newest commits on a branch, or on the default branch when none is given."""
    _, name = linked_repo(db, project_id, actor, repo)
    params = {"per_page": 50}
    if branch:
        params["sha"] = branch
    return [_commit(c) for c in call("GET", f"/repos/{name}/commits", params=params)]


def create_pull(db, project_id, data, actor, repo=None):
    _, name = linked_repo(db, project_id, actor, repo)
    if data.head == data.base:
        raise HTTPException(422, "Choose two different branches")
    pull = call(
        "POST",
        f"/repos/{name}/pulls",
        json={
            "title": data.title,
            "head": data.head,
            "base": data.base,
            "body": data.body,
            "draft": data.draft,
        },
    )
    return _pull(pull)


def merge(db, project_id, number, data, actor, repo=None):
    project, name = linked_repo(db, project_id, actor, repo)
    if not can_merge(db, actor, project):
        raise HTTPException(
            403, "Only an admin, the owning manager or a project lead can merge"
        )
    result = call(
        "PUT",
        f"/repos/{name}/pulls/{number}/merge",
        json={"merge_method": data.method},
    )
    return {
        "merged": result.get("merged", False),
        "message": result.get("message", ""),
        "sha": result.get("sha", ""),
    }
