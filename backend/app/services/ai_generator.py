import base64
import json
import re
from urllib.parse import quote
import httpx
from fastapi import HTTPException
from pydantic import ValidationError
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

SOURCE_EXTENSIONS = (
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".java",
    ".kt",
    ".cs",
    ".go",
    ".rb",
    ".php",
)
# Folders and files that say little about product behavior; read them last.
LOW_SIGNAL_FOLDERS = {
    "test",
    "tests",
    "__tests__",
    "spec",
    "migrations",
    "alembic",
    "vendor",
    "dist",
    "build",
    "node_modules",
}
MAX_FILES = 10
MAX_CHARS_PER_FILE = 2500
MAX_PATCH_CHARS = 3000
MAX_PULL_FILE_PAGES = 3
PRIORITIES = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
TEST_TYPES = ("FUNCTIONAL", "REGRESSION", "INTEGRATION", "UI", "API")
# Draft size limits; the schema rejects anything larger.
MAX_STORIES = 20
MAX_LIST = 12
MAX_STEPS = 20


def _repo(db, actor, project_id):
    project = project_access(db, project_id, actor)
    name = github.repo_name(project.github_repo)
    if not name:
        raise HTTPException(409, "This project has no linked GitHub repository")
    return project, name


def _default_branch(name):
    return github.call("GET", f"/repos/{name}").get("default_branch") or "main"


def _branch_sha(name, branch):
    return github.call("GET", f"/repos/{name}/git/ref/heads/{quote(branch)}")["object"][
        "sha"
    ]


def _repo_info(name, branch=""):
    branch = branch or _default_branch(name)
    return branch, _branch_sha(name, branch)


def _tree(name, ref):
    """Every file at a ref, and whether GitHub cut the list short."""
    tree = github.call(
        "GET", f"/repos/{name}/git/trees/{quote(ref)}", params={"recursive": 1}
    )
    return tree.get("tree", []), bool(tree.get("truncated"))


def _is_source(path):
    return path.endswith(SOURCE_EXTENSIONS)


def _low_signal(path):
    parts = path.lower().split("/")
    file = parts[-1]
    return (
        any(part in LOW_SIGNAL_FOLDERS for part in parts[:-1])
        or file.startswith("test_")
        or ".test." in file
        or ".spec." in file
        or file == "__init__.py"
    )


def _module_counts(paths):
    """Source files per module: the repository root, top folders and their subfolders."""
    counts: dict[str, int] = {"": 0}
    for path in paths:
        if not _is_source(path):
            continue
        counts[""] += 1
        parts = path.split("/")
        if len(parts) > 1:
            counts[parts[0]] = counts.get(parts[0], 0) + 1
            counts["/".join(parts[:2])] = counts.get("/".join(parts[:2]), 0) + 1
    return counts


def modules(db, actor, project_id):
    _, name = _repo(db, actor, project_id)
    branch, _ = _repo_info(name)
    items, _ = _tree(name, branch)
    counts = _module_counts(
        item.get("path", "") for item in items if item.get("type") == "blob"
    )
    return [
        {"path": path, "file_count": count}
        for path, count in sorted(
            counts.items(), key=lambda item: (item[0] != "", item[0])
        )
        if count
    ]


def _folders(path):
    """Every folder above a file, outermost first."""
    parts = path.split("/")[:-1]
    return ["/".join(parts[: i + 1]) for i in range(len(parts))]


def _pull_files(name, number):
    files = []
    for page in range(1, MAX_PULL_FILE_PAGES + 1):
        batch = github.call(
            "GET",
            f"/repos/{name}/pulls/{number}/files",
            params={"per_page": 100, "page": page},
        )
        files += batch
        if len(batch) < 100:
            break
    return files


def pull_module(db, actor, project_id, number):
    """The narrowest folder holding most of a pull request's changed source files."""
    _, name = _repo(db, actor, project_id)
    changed = [
        f["filename"] for f in _pull_files(name, number) if _is_source(f["filename"])
    ]
    branch, _ = _repo_info(name)
    items, _ = _tree(name, branch)
    # Only folders on the default branch: those are the modules the page lists.
    existing = {
        folder
        for item in items
        if item.get("type") == "blob" and _is_source(item.get("path", ""))
        for folder in _folders(item["path"])
    }
    counts: dict[str, int] = {}
    for path in changed:
        for folder in _folders(path):
            if folder in existing:
                counts[folder] = counts.get(folder, 0) + 1
    # Most matching files wins; among equals, the deeper (narrower) folder.
    best = max(counts, key=lambda f: (counts[f], f.count("/")), default="")
    return {
        "module_path": best,
        "changed_files": len(changed),
        "matched_files": counts.get(best, 0),
    }


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


def _sample_sources(name, sha, module_path):
    """The module's source files at a commit, product code before tests and migrations."""
    items, truncated = _tree(name, sha)
    paths = [
        item["path"]
        for item in items
        if item.get("type") == "blob"
        and _is_source(item.get("path", ""))
        and _in_module(item["path"], module_path)
    ]
    paths.sort(key=_low_signal)
    notes = []
    if len(paths) > MAX_FILES:
        notes.append(
            f"Read {MAX_FILES} of {len(paths)} source files in "
            f"{module_path or 'the repository'}; pick a narrower module for a closer draft."
        )
    if truncated:
        notes.append(
            "GitHub returned a partial file list for this large repository, "
            "so some files were not considered."
        )
    picked = paths[:MAX_FILES]
    return [{"path": p, "content": _read_source(name, sha, p)} for p in picked], notes


def _changed_sources(name, sha, files, module_path, label):
    """Changed source files with their diffs, largest product changes first."""
    changed = [
        f
        for f in files
        if _is_source(f["filename"])
        and f.get("status") != "removed"
        and _in_module(f["filename"], module_path)
    ]
    changed.sort(key=lambda f: (_low_signal(f["filename"]), -f.get("changes", 0)))
    picked = changed[:MAX_FILES]
    notes = (
        [
            f"Read the {len(picked)} largest of {len(changed)} changed source files in {label}."
        ]
        if len(changed) > len(picked)
        else []
    )
    sources = [
        {
            "path": f["filename"],
            "status": f.get("status", ""),
            "patch": (f.get("patch") or "")[:MAX_PATCH_CHARS],
            "content": _read_source(name, sha, f["filename"]),
        }
        for f in picked
    ]
    return sources, notes


def _no_changes(label, module_path):
    where = f" in {module_path}" if module_path else ""
    return HTTPException(422, f"{label} changes no source files{where}")


def _resolve(name, data):
    """The code to draft from: (kind, ref, commit, context, sources, notes)."""
    module = data.module_path
    if data.pull_number:
        number = data.pull_number
        pull = github.call("GET", f"/repos/{name}/pulls/{number}")
        sha = pull["head"]["sha"]
        label = f"PR #{number}"
        sources, notes = _changed_sources(
            name, sha, _pull_files(name, number), module, label
        )
        if not sources:
            raise _no_changes(label, module)
        context = (
            f"Pull request #{number}: {pull.get('title', '')}\n{pull.get('body') or ''}"
        )
        return "PULL", str(number), sha, context[:2000], sources, notes
    if data.commit:
        commit = github.call("GET", f"/repos/{name}/commits/{data.commit}")
        sha = commit["sha"]
        label = f"commit {sha[:7]}"
        sources, notes = _changed_sources(
            name, sha, commit.get("files", []), module, label
        )
        if not sources:
            raise _no_changes(label, module)
        message = (commit.get("commit") or {}).get("message", "")
        return "COMMIT", sha, sha, f"Commit {sha[:7]}: {message}"[:2000], sources, notes
    default = _default_branch(name)
    if data.branch and data.branch != default:
        sha = _branch_sha(name, data.branch)
        base = _branch_sha(name, default)
        # Compare by SHA so a branch name with slashes is never ambiguous.
        compare = github.call("GET", f"/repos/{name}/compare/{base}...{sha}")
        sources, notes = _changed_sources(
            name,
            sha,
            compare.get("files", []),
            module,
            f"{data.branch} compared with {default}",
        )
        context = f"Changes on branch {data.branch} compared with {default}"
        if not sources:
            sources, notes = _sample_sources(name, sha, module)
            notes.insert(
                0,
                f"{data.branch} has no source changes compared with {default}, "
                "so its files were read instead.",
            )
            context = f"Branch {data.branch}"
        return "BRANCH", data.branch, sha, context, sources, notes
    sha = _branch_sha(name, default)
    sources, notes = _sample_sources(name, sha, module)
    return (
        "DEFAULT",
        default,
        sha,
        f"Module {module or '(entire repository)'} on {default}",
        sources,
        notes,
    )


def _signals(sources):
    text = "\n".join(f["content"] for f in sources)
    routes = re.findall(r"[/][A-Za-z0-9_/{}/:-]+", text)
    names = re.findall(r"(?:function|def|class|const)\s+([A-Za-z][A-Za-z0-9_]*)", text)
    return {
        "routes": sorted(set(routes))[:12],
        "names": sorted(set(names))[:20],
        "files": [f["path"] for f in sources],
    }


def _coverage_tests(module, coverage, covers):
    """Template tests for each coverage kind; `covers` maps a kind to criterion indexes."""
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
                criteria=covers["POSITIVE"],
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
                criteria=covers["NEGATIVE"],
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
                criteria=covers["BOUNDARY"],
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
                criteria=covers["VALIDATION"],
            )
        )
    return tests or _coverage_tests(module, ["POSITIVE"], covers)


def _fallback(project, module_path, data, sources, reason):
    module = module_path.split("/")[-1] if module_path else project.name
    signals = _signals(sources)
    route_hint = ", ".join(signals["routes"][:4]) or "the module screens and APIs"
    file_hint = ", ".join(signals["files"][:4]) or "linked repository files"
    notes = [
        f"AI draft unavailable: {reason} This is a code-analysis template; "
        "rewrite it before saving.",
        f"Files sampled: {file_hint}",
    ]
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
        covers = {
            "POSITIVE": [0, 1],
            "NEGATIVE": [],
            "BOUNDARY": [2],
            "VALIDATION": [2],
        }
    else:
        stories.append(
            GeneratedStory(
                title=f"Validate {module} behavior",
                description=f"Generated coverage holder for {module}.",
                acceptance_criteria=[
                    f"The {module} behavior is available to authorized users."
                ],
            )
        )
        covers = {
            kind: [0] for kind in ("POSITIVE", "NEGATIVE", "BOUNDARY", "VALIDATION")
        }
    if data.output_type in ("TEST_CASES", "BOTH"):
        stories[0].test_cases = _coverage_tests(module, data.coverage, covers)
    return stories, notes


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


def _choice(value, allowed, default):
    """An allowed value regardless of case or spacing ("High" → "HIGH"), else the default."""
    text = str(value or "").strip().upper().replace(" ", "_")
    return text if text in allowed else default


def _number(value, default, low, high):
    try:
        number = int(float(value))
    except (TypeError, ValueError):
        return default
    return max(low, min(high, number))


def _covers(value, criteria_texts):
    """Criterion indexes from numbers or from criterion text, in range and unique."""
    found = []
    for item in value if isinstance(value, list) else [value]:
        if isinstance(item, bool):
            continue
        if isinstance(item, (int, float)) or (
            isinstance(item, str) and item.strip().isdigit()
        ):
            index = int(item)
        elif isinstance(item, str) and item.strip() in criteria_texts:
            index = criteria_texts.index(item.strip())
        else:
            continue
        if 0 <= index < len(criteria_texts) and index not in found:
            found.append(index)
    return found[:MAX_LIST]


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


def _normalize_test(test, criteria_texts):
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
        # Coverage words such as "Negative" are not test types; they become FUNCTIONAL.
        "test_type": _choice(test.get("test_type"), TEST_TYPES, "FUNCTIONAL"),
        "priority": _choice(test.get("priority"), PRIORITIES, "MEDIUM"),
        "preconditions": str(test.get("preconditions") or ""),
        "test_data": str(test.get("test_data") or ""),
        "expected_result": str(test.get("expected_result") or ""),
        "steps": steps[:MAX_STEPS],
        "criteria": _covers(test.get("covers", test.get("criteria")), criteria_texts),
    }


def _normalize_story(story):
    if isinstance(story, str):
        story = {"title": story}
    if not isinstance(story, dict):
        return None
    title = story.get("title") or story.get("summary") or story.get("name")
    if not title:
        return None
    criteria_texts = _text_list(
        story.get("acceptance_criteria") or story.get("criteria")
    )[:MAX_LIST]
    tests = [
        normalized
        for test in story.get("test_cases") or story.get("tests") or []
        if (normalized := _normalize_test(test, criteria_texts))
    ]
    try:
        return GeneratedStory.model_validate(
            {
                "title": str(title)[:300],
                "description": str(story.get("description") or ""),
                "priority": _choice(story.get("priority"), PRIORITIES, "MEDIUM"),
                "story_points": _number(story.get("story_points"), 3, 0, 100),
                "acceptance_criteria": criteria_texts,
                "test_cases": tests[:MAX_LIST],
            }
        )
    except ValidationError:
        # One malformed story is dropped; the rest of the draft is kept.
        return None


def _unwrap(raw):
    # The model sometimes echoes the request and nests the answer under "schema".
    for key in ("schema", "draft", "result", "output"):
        inner = raw.get(key)
        if isinstance(inner, dict) and not (
            raw.get("user_stories") or raw.get("stories")
        ):
            raw = inner
    return raw


def _normalize_draft(raw):
    """Stories and notes from the model's answer, repaired rather than rejected."""
    raw = _unwrap(raw)
    stories = raw.get("user_stories") or raw.get("stories") or []
    if not isinstance(stories, list):
        stories = [stories]
    normalized = [story for item in stories if (story := _normalize_story(item))][
        :MAX_STORIES
    ]
    notes = _text_list(raw.get("notes"))
    notes.append("Review and approve each item before saving it into the project.")
    return normalized, notes


PROMPT_SCHEMA = {
    "user_stories": [
        {
            "title": "string",
            "description": "As a ... I want ... so that ...",
            "priority": "LOW | MEDIUM | HIGH | CRITICAL",
            "story_points": "integer from 1 to 13",
            "acceptance_criteria": ["string"],
            "test_cases": [
                {
                    "title": "string",
                    "test_type": "FUNCTIONAL | REGRESSION | INTEGRATION | UI | API",
                    "priority": "LOW | MEDIUM | HIGH | CRITICAL",
                    "covers": [
                        "index (from 0) of each acceptance criterion this test proves"
                    ],
                    "preconditions": "string",
                    "test_data": "string",
                    "expected_result": "string",
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
}


def _openai_error(response):
    status = response.status_code
    if status == 401:
        return "OpenAI rejected the API key."
    if status == 429:
        return "OpenAI rate limit or quota was reached."
    return f"OpenAI returned error {status}."


def _openai_draft(project, repo, module_path, data, sources, context):
    """(stories, notes) from OpenAI, or (None, reason) when no usable draft came back."""
    if not settings.openai_api_key:
        return None, "OpenAI is not configured (no OPENAI_API_KEY)."
    if not sources:
        return None, "No source files were found to read."
    changed = any("patch" in source for source in sources)
    prompt = {
        "repository": repo,
        "project": project.name,
        "source": context,
        "module_path": module_path,
        "output_type": data.output_type,
        "coverage": data.coverage,
        "sources": sources,
        "schema": PROMPT_SCHEMA,
    }
    rules = [
        "Generate concise software requirements as JSON.",
        "Only include behavior supported by the source files.",
        (
            "The sources are the files this change touched: 'patch' is the unified diff "
            "and 'content' the file after the change. Describe the behavior the change "
            "adds or alters."
            if changed
            else "The sources are files from one module of the application."
        ),
        "Write at most 8 user stories, 8 acceptance criteria per story, "
        "8 test cases per story and 12 steps per test case.",
        "Use exactly one of the listed words for priority and test_type.",
        "Write test cases for each requested coverage kind (positive, negative, "
        "boundary, validation) and say which in the title.",
        "In 'covers', list the acceptance criteria each test case proves by index.",
        "Respond with a single JSON object shaped exactly like the request's "
        '"schema" value, with user_stories and notes at the top level. '
        "Do not echo the request.",
    ]
    try:
        response = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            timeout=60,
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={
                "model": "gpt-4o-mini",
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": " ".join(rules)},
                    {"role": "user", "content": json.dumps(prompt)},
                ],
            },
        )
    except httpx.TimeoutException:
        return None, "OpenAI did not answer within 60 seconds."
    except httpx.HTTPError:
        return None, "Could not reach OpenAI."
    if response.status_code >= 400:
        return None, _openai_error(response)
    try:
        raw = json.loads(response.json()["choices"][0]["message"]["content"])
        stories, notes = _normalize_draft(raw)
    except (KeyError, IndexError, ValueError, TypeError, AttributeError):
        return None, "OpenAI's answer could not be read."
    if not stories:
        return None, "OpenAI returned no usable user stories for these files."
    return stories, notes


def generate(db, actor, data):
    project, name = _repo(db, actor, data.project_id)
    kind, ref, sha, context, sources, source_notes = _resolve(name, data)
    stories, notes = _openai_draft(
        project, name, data.module_path, data, sources, context
    )
    if stories is None:
        reason = notes
        stories, notes = _fallback(project, data.module_path, data, sources, reason)
    return GeneratedDraft(
        project_id=project.id,
        repository=name,
        module_path=data.module_path,
        source_commit=sha,
        source_kind=kind,
        source_ref=ref,
        output_type=data.output_type,
        coverage=data.coverage,
        user_stories=stories,
        notes=[*notes, *source_notes, f"Source commit: {sha[:12]}"],
    )


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
        "source_kind": data.source_kind,
        "source_ref": data.source_ref,
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
                    # Only the criteria this test proves, so coverage stays honest.
                    criterion_ids=[
                        criterion_ids[i]
                        for i in dict.fromkeys(test.criteria)
                        if 0 <= i < len(criterion_ids)
                    ],
                ),
            )
            saved.ai_source = source
            db.commit()
            test_case_ids.append(saved.id)
    return {"issue_ids": issue_ids, "test_case_ids": test_case_ids}


def suggestions(db, actor, project_id):
    """Generated items whose own source (branch, pull request or module) has changed."""
    project, name = _repo(db, actor, project_id)
    default = _default_branch(name)
    heads: dict[tuple[str, str], str | None] = {}
    moved: dict[tuple[str, str, str], bool] = {}

    def head(kind, ref):
        key = (kind, ref)
        if key not in heads:
            try:
                if kind == "COMMIT":
                    heads[key] = None  # Pinned to one commit: never out of date.
                elif kind == "PULL":
                    heads[key] = github.call("GET", f"/repos/{name}/pulls/{ref}")[
                        "head"
                    ]["sha"]
                else:
                    heads[key] = _branch_sha(name, ref)
            except HTTPException as error:
                if error.status_code != 404:
                    raise
                heads[key] = None  # The branch or pull request is gone.
        return heads[key]

    def changed(old, new, module_path):
        if old == new:
            return False
        key = (old, new, module_path)
        if key not in moved:
            try:
                files = github.call("GET", f"/repos/{name}/compare/{old}...{new}").get(
                    "files", []
                )
                moved[key] = any(
                    _is_source(f["filename"]) and _in_module(f["filename"], module_path)
                    for f in files
                )
            except HTTPException as error:
                if error.status_code != 404:
                    raise
                moved[key] = True  # The old commit was rewritten away.
        return moved[key]

    stale_commits = set()

    def stale(source):
        commit = source.get("source_commit")
        if source.get("repository") != name or not commit:
            return False
        kind = source.get("source_kind") or "DEFAULT"
        ref = source.get("source_ref") or default
        current = head(kind, ref)
        if current and changed(commit, current, source.get("module_path", "")):
            stale_commits.add(commit)
            return True
        return False

    story_ids = [
        issue.id
        for issue in db.scalars(select(Issue).where(Issue.project_id == project.id))
        if stale(issue.ai_source or {})
    ]
    test_ids = [
        test.id
        for test in db.scalars(
            select(TestCase).where(TestCase.project_id == project.id)
        )
        if stale(test.ai_source or {})
    ]
    current = head("DEFAULT", default)
    return {
        "source_commit": next(iter(sorted(stale_commits)), current),
        "current_commit": current,
        "stale_story_ids": story_ids,
        "stale_test_case_ids": test_ids,
        "message": (
            "Generated items may need updates."
            if story_ids or test_ids
            else "Generated items are up to date with their source code."
        ),
    }
