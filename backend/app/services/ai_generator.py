import base64
import json
import re
from urllib.parse import quote
import httpx
from fastapi import HTTPException
from sqlalchemy import select
from app.core.config import settings
from app.models import Issue, TestCase
from app.schemas.ai_generator import (
    GeneratedDraft,
    GeneratedStory,
    GeneratedTestCase,
    GeneratedStep,
)
from app.schemas.criterion import CriterionIn
from app.schemas.issue import IssueIn
from app.schemas.test_case import TestCaseIn, StepIn
from app.services import github, issues, criteria, test_cases
from app.services.access import project_access

SOURCE_EXTENSIONS = (".py", ".ts", ".tsx", ".js", ".jsx")
MAX_FILES = 10
MAX_CHARS_PER_FILE = 2500


def _repo(db, actor, project_id):
    project = project_access(db, project_id, actor)
    name = github.repo_name(project.github_repo)
    if not name:
        raise HTTPException(409, "This project has no linked GitHub repository")
    return project, name


def _repo_info(name):
    repo = github.call("GET", f"/repos/{name}")
    branch = repo.get("default_branch") or "main"
    ref = github.call("GET", f"/repos/{name}/git/ref/heads/{quote(branch)}")
    return branch, ref["object"]["sha"]


def _tree(name, branch):
    tree = github.call(
        "GET", f"/repos/{name}/git/trees/{quote(branch)}", params={"recursive": 1}
    )
    return tree.get("tree", [])


def modules(db, actor, project_id):
    _, name = _repo(db, actor, project_id)
    branch, _ = _repo_info(name)
    counts: dict[str, int] = {"": 0}
    for item in _tree(name, branch):
        path = item.get("path", "")
        if item.get("type") != "blob" or not path.endswith(SOURCE_EXTENSIONS):
            continue
        counts[""] += 1
        parts = path.split("/")
        if len(parts) > 1:
            counts[parts[0]] = counts.get(parts[0], 0) + 1
            counts["/".join(parts[:2])] = counts.get("/".join(parts[:2]), 0) + 1
    return [
        {"path": path, "file_count": count}
        for path, count in sorted(counts.items(), key=lambda item: (item[0] != "", item[0]))
        if count
    ]


def _read_source(name, sha, path):
    item = github.call(
        "GET", f"/repos/{name}/contents/{quote(path, safe='/')}", params={"ref": sha}
    )
    content = item.get("content", "")
    if item.get("encoding") != "base64":
        return ""
    return base64.b64decode(content).decode("utf-8", errors="ignore")[
        :MAX_CHARS_PER_FILE
    ]


def _in_module(path, module_path):
    if not module_path:
        return True
    prefix = module_path.rstrip("/")
    return path == prefix or path.startswith(prefix + "/")


def _sample_sources(name, branch, sha, module_path):
    files = []
    for item in _tree(name, branch):
        path = item.get("path", "")
        if item.get("type") != "blob" or not path.endswith(SOURCE_EXTENSIONS):
            continue
        if not _in_module(path, module_path):
            continue
        files.append(path)
        if len(files) >= MAX_FILES:
            break
    return [{"path": path, "content": _read_source(name, sha, path)} for path in files]


def _signals(sources):
    text = "\n".join(f["content"] for f in sources)
    routes = re.findall(r"[/][A-Za-z0-9_/{}/:-]+", text)
    names = re.findall(r"(?:function|def|class|const)\s+([A-Za-z][A-Za-z0-9_]*)", text)
    return {
        "routes": sorted(set(routes))[:12],
        "names": sorted(set(names))[:20],
        "files": [f["path"] for f in sources],
    }


def _coverage_tests(module, coverage):
    kinds = coverage or ["POSITIVE"]
    tests = []
    if "POSITIVE" in kinds:
        tests.append(
            GeneratedTestCase(
                title=f"Verify {module} happy path",
                expected_result=f"The {module} workflow completes successfully.",
                steps=[
                    GeneratedStep(
                        action=f"Open the {module} workflow",
                        expected_result="The page or API loads successfully.",
                    ),
                    GeneratedStep(
                        action="Submit valid data",
                        expected_result="The system saves the change and shows the updated data.",
                    ),
                ],
            )
        )
    if "NEGATIVE" in kinds:
        tests.append(
            GeneratedTestCase(
                title=f"Reject unauthorized {module} access",
                expected_result="The system denies the request and does not change data.",
                steps=[
                    GeneratedStep(
                        action=f"Call the {module} action without permission",
                        expected_result="The request is rejected.",
                    )
                ],
            )
        )
    if "BOUNDARY" in kinds:
        tests.append(
            GeneratedTestCase(
                title=f"Handle {module} boundary values",
                expected_result="The system accepts valid limits and rejects values outside them.",
                steps=[
                    GeneratedStep(
                        action="Submit the shortest allowed value",
                        expected_result="The value is accepted.",
                    ),
                    GeneratedStep(
                        action="Submit a value longer than the allowed limit",
                        expected_result="Validation is displayed and nothing is saved.",
                    ),
                ],
            )
        )
    if "VALIDATION" in kinds:
        tests.append(
            GeneratedTestCase(
                title=f"Validate required {module} fields",
                expected_result="The system prevents invalid data from being saved.",
                steps=[
                    GeneratedStep(
                        action="Submit the workflow with required data missing",
                        expected_result="Validation messages are displayed.",
                    )
                ],
            )
        )
    return tests or _coverage_tests(module, ["POSITIVE"])


def _fallback(project, repo, module_path, sha, data, sources):
    module = module_path.split("/")[-1] if module_path else project.name
    signals = _signals(sources)
    route_hint = ", ".join(signals["routes"][:4]) or "the module screens and APIs"
    file_hint = ", ".join(signals["files"][:4]) or "linked repository files"
    notes = [
        "Generated from source-code signals. Review business wording before saving.",
        f"Files sampled: {file_hint}",
        f"Source commit: {sha[:12]}",
    ]
    if not settings.openai_api_key:
        notes.append("OpenAI is not configured, so this draft used code analysis only.")
    stories = []
    if data.output_type in ("USER_STORIES", "BOTH"):
        stories.append(
            GeneratedStory(
                title=f"Use {module} workflow",
                description=(
                    f"As a project user, I want to use the {module} workflow so "
                    "that I can complete my work from the application."
                ),
                acceptance_criteria=[
                    f"The user can open the {module} workflow successfully.",
                    f"The workflow uses the expected routes or APIs: {route_hint}.",
                    "The system shows a clear error when required data is missing.",
                ],
                test_cases=[],
            )
        )
    if data.output_type in ("TEST_CASES", "BOTH"):
        target = stories or [
            GeneratedStory(
                title=f"Validate {module} behavior",
                description=f"Generated coverage holder for {module}.",
                acceptance_criteria=[
                    f"The {module} behavior is available to authorized users."
                ],
            )
        ]
        target[0].test_cases = _coverage_tests(module, data.coverage)
        stories = target
    return GeneratedDraft(
        project_id=project.id,
        repository=repo,
        module_path=module_path,
        source_commit=sha,
        output_type=data.output_type,
        coverage=data.coverage,
        user_stories=stories,
        notes=notes,
    )


def _text_list(value):
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    items = []
    for item in value or []:
        if isinstance(item, str) and item.strip():
            items.append(item.strip())
        elif isinstance(item, dict):
            text = item.get("description") or item.get("text") or item.get("title")
            if text:
                items.append(str(text).strip())
    return items


def _normalize_step(step, index):
    if isinstance(step, str):
        return {
            "action": step,
            "test_data": "",
            "expected_result": "The system behaves as specified.",
        }
    if not isinstance(step, dict):
        return None
    action = step.get("action") or step.get("step") or f"Step {index}"
    return {
        "action": str(action)[:10000],
        "test_data": str(step.get("test_data") or ""),
        "expected_result": str(
            step.get("expected_result") or step.get("expected") or ""
        ),
    }


def _normalize_test(test):
    if isinstance(test, str):
        test = {"title": test}
    if not isinstance(test, dict) or not test.get("title"):
        return None
    steps = [
        normalized
        for index, step in enumerate(test.get("steps") or [], 1)
        if (normalized := _normalize_step(step, index))
    ]
    return {
        "title": str(test["title"])[:300],
        "test_type": test.get("test_type") or "FUNCTIONAL",
        "priority": test.get("priority") or "MEDIUM",
        "preconditions": str(test.get("preconditions") or ""),
        "test_data": str(test.get("test_data") or ""),
        "expected_result": str(test.get("expected_result") or ""),
        "steps": steps,
    }


def _normalize_story(story):
    if isinstance(story, str):
        story = {"title": story}
    if not isinstance(story, dict):
        return None
    title = story.get("title") or story.get("summary") or story.get("name")
    if not title:
        return None
    tests = [
        normalized
        for test in story.get("test_cases") or story.get("tests") or []
        if (normalized := _normalize_test(test))
    ]
    return {
        "title": str(title)[:300],
        "description": str(story.get("description") or ""),
        "priority": story.get("priority") or "MEDIUM",
        "story_points": story.get("story_points") or 3,
        "acceptance_criteria": _text_list(
            story.get("acceptance_criteria") or story.get("criteria")
        ),
        "test_cases": tests,
    }


def _unwrap(raw):
    # The model sometimes echoes the request and nests the answer under "schema".
    for key in ("schema", "draft", "result", "output"):
        inner = raw.get(key)
        if isinstance(inner, dict) and not (raw.get("user_stories") or raw.get("stories")):
            raw = inner
    return raw


def _normalize_draft(raw, project, repo, module_path, sha, data):
    raw = _unwrap(raw)
    stories = raw.get("user_stories") or raw.get("stories") or []
    notes = _text_list(raw.get("notes"))
    notes.append("Review and approve each item before saving it into the project.")
    payload = {
        "project_id": project.id,
        "repository": repo,
        "module_path": module_path,
        "source_commit": sha,
        "output_type": data.output_type,
        "coverage": data.coverage or raw.get("coverage") or ["POSITIVE"],
        "user_stories": [
            normalized
            for story in stories
            if (normalized := _normalize_story(story))
        ],
        "notes": notes,
    }
    return GeneratedDraft.model_validate(payload)


def _openai_draft(project, repo, module_path, sha, data, sources):
    if not settings.openai_api_key:
        return None
    prompt = {
        "repository": repo,
        "module_path": module_path,
        "project": project.name,
        "output_type": data.output_type,
        "coverage": data.coverage,
        "sources": sources,
        "schema": {
            "user_stories": [
                {
                    "title": "string",
                    "description": "As a ... I want ... so that ...",
                    "acceptance_criteria": ["string"],
                    "test_cases": [
                        {
                            "title": "string",
                            "steps": [
                                {
                                    "action": "string",
                                    "test_data": "string",
                                    "expected_result": "string",
                                }
                            ],
                        }
                    ],
                }
            ],
            "notes": ["string"],
        },
    }
    try:
        response = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            timeout=60,
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={
                "model": "gpt-4o-mini",
                "response_format": {"type": "json_object"},
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "Generate concise software requirements as JSON. "
                            "Only include behavior supported by the source files. "
                            "Human review is required before publishing. "
                            "Respond with a single JSON object shaped exactly like "
                            "the request's \"schema\" value, with user_stories and "
                            "notes at the top level. Do not echo the request."
                        ),
                    },
                    {"role": "user", "content": json.dumps(prompt)},
                ],
            },
        )
    except httpx.HTTPError:
        return None
    if response.status_code >= 400:
        return None
    try:
        raw = json.loads(response.json()["choices"][0]["message"]["content"])
        draft = _normalize_draft(raw, project, repo, module_path, sha, data)
    except (KeyError, ValueError, TypeError):
        return None
    return draft if draft.user_stories else None


def generate(db, actor, data):
    project, name = _repo(db, actor, data.project_id)
    branch, sha = _repo_info(name)
    sources = _sample_sources(name, branch, sha, data.module_path)
    draft = _openai_draft(project, name, data.module_path, sha, data, sources)
    return draft or _fallback(project, name, data.module_path, sha, data, sources)


def save(db, actor, data):
    project_access(db, data.project_id, actor)
    selected = (
        set(data.selected_story_indexes)
        if data.selected_story_indexes is not None
        else set(range(len(data.user_stories)))
    )
    source = {
        "repository": data.repository,
        "module_path": data.module_path,
        "source_commit": data.source_commit,
        "generator": "ai-requirements-test-generator",
    }
    issue_ids = []
    test_case_ids = []
    for index, story in enumerate(data.user_stories):
        if index not in selected:
            continue
        issue = issues.create(
            db,
            IssueIn(
                project_id=data.project_id,
                issue_type="STORY",
                summary=story.title,
                description=story.description,
                priority=story.priority,
                story_points=story.story_points,
                labels=["ai-generated"],
            ),
            actor,
        )
        issue.ai_source = source
        db.commit()
        issue_ids.append(issue.id)
        criterion_ids = []
        for order, text in enumerate(story.acceptance_criteria):
            criterion = criteria.save(
                db,
                actor,
                CriterionIn(description=text, order_index=order),
                issue_id=issue.id,
            )
            criterion_ids.append(criterion.id)
        for test in story.test_cases:
            saved = test_cases.save(
                db,
                actor,
                TestCaseIn(
                    project_id=data.project_id,
                    issue_id=issue.id,
                    title=test.title,
                    test_type=test.test_type,
                    priority=test.priority,
                    preconditions=test.preconditions,
                    expected_result=test.expected_result,
                    test_data=test.test_data,
                    steps=[
                        StepIn(
                            step_number=i + 1,
                            action=step.action,
                            test_data=step.test_data,
                            expected_result=step.expected_result,
                        )
                        for i, step in enumerate(test.steps)
                    ],
                    criterion_ids=criterion_ids,
                ),
            )
            saved.ai_source = source
            db.commit()
            test_case_ids.append(saved.id)
    return {"issue_ids": issue_ids, "test_case_ids": test_case_ids}


def suggestions(db, actor, project_id):
    project, name = _repo(db, actor, project_id)
    _, current = _repo_info(name)
    story_ids = []
    test_ids = []
    source_commits = set()
    for issue in db.scalars(select(Issue).where(Issue.project_id == project.id)):
        source = issue.ai_source or {}
        if source.get("repository") == name and source.get("source_commit") != current:
            story_ids.append(issue.id)
            source_commits.add(source.get("source_commit", ""))
    for test in db.scalars(select(TestCase).where(TestCase.project_id == project.id)):
        source = test.ai_source or {}
        if source.get("repository") == name and source.get("source_commit") != current:
            test_ids.append(test.id)
            source_commits.add(source.get("source_commit", ""))
    return {
        "source_commit": next(iter(source_commits - {""}), current),
        "current_commit": current,
        "stale_story_ids": story_ids,
        "stale_test_case_ids": test_ids,
        "message": (
            "Generated items may need updates."
            if story_ids or test_ids
            else "Generated items are up to date with the current repository commit."
        ),
    }
