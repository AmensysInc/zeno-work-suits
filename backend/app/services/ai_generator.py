import base64
import json
import re
from concurrent.futures import ThreadPoolExecutor
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
# Never product code: skipped entirely rather than read last.
SKIPPED_FOLDERS = {"node_modules", "dist", "build", "vendor", ".next", "coverage"}
# Path words that usually mark user-facing behavior; read these first.
HIGH_SIGNAL_WORDS = (
    "route",
    "router",
    "controller",
    "api",
    "endpoint",
    "view",
    "page",
    "screen",
    "service",
    "handler",
    "component",
    "form",
    "model",
    "schema",
    "store",
    "feature",
    "action",
)
# File-name words for plumbing: read after product code.
PLUMBING_WORDS = (
    "config",
    "setup",
    "constant",
    "types",
    "util",
    "helper",
    "polyfill",
    "logger",
    "theme",
    "style",
)
# Reading budget for one draft. The code is split into parts of PART_CHARS that
# are drafted in parallel, so a whole repository is covered, not a sample.
MAX_FILES = 120
MAX_CHARS_PER_FILE = 12000
MAX_PATCH_CHARS = 8000
MAX_FILE_BYTES = 200_000
PART_CHARS = 60_000
MAX_PARTS = 6
READ_WORKERS = 8
MAX_PULL_FILE_PAGES = 3
OPENAI_TIMEOUT = 100
PRIORITIES = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
TEST_TYPES = ("FUNCTIONAL", "REGRESSION", "INTEGRATION", "UI", "API")
# Draft size limits; the schema rejects anything larger.
MAX_STORIES = 40
MAX_LIST = 12
MAX_STEPS = 20


def _repo(db, actor, project_id, repo=None):
    """The project and one of its linked repositories (the first unless `repo` says)."""
    return github.linked_repo(db, project_id, actor, repo)


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
    parts = path.lower().split("/")
    return (
        path.endswith(SOURCE_EXTENSIONS)
        and not parts[-1].endswith((".min.js", ".d.ts", ".map"))
        and not any(part in SKIPPED_FOLDERS for part in parts[:-1])
    )


def _rank(path):
    """Reading order: product behavior first, plumbing next, tests and migrations last."""
    if _low_signal(path):
        return 3
    lower = path.lower()
    if any(word in lower.rsplit("/", 1)[-1] for word in PLUMBING_WORDS):
        return 2
    if any(word in lower for word in HIGH_SIGNAL_WORDS):
        return 0
    return 1


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


def modules(db, actor, project_id, repo=None):
    _, name = _repo(db, actor, project_id, repo)
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


def pull_module(db, actor, project_id, number, repo=None):
    """The narrowest folder holding most of a pull request's changed source files."""
    _, name = _repo(db, actor, project_id, repo)
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


def _read_many(name, sha, paths):
    """File contents by path, fetched in parallel."""
    if not paths:
        return {}
    with ThreadPoolExecutor(max_workers=min(READ_WORKERS, len(paths))) as pool:
        return dict(zip(paths, pool.map(lambda p: _read_source(name, sha, p), paths)))


def _group_of(path, module_path, depth):
    rel = path[len(module_path.rstrip("/")) + 1 :] if module_path else path
    folders = rel.split("/")[:-1]
    return "/".join(folders[:depth]) or "(top level)"


def _grouping_depth(paths, module_path):
    """Folder depth that splits the code into several areas (e.g. src/pages, src/api)."""
    depth = 1
    while depth < 4 and len({_group_of(p, module_path, depth) for p in paths}) < 3:
        if not any(len(p.split("/")) > depth + 1 for p in paths):
            break
        depth += 1
    return depth


def _pick_across_areas(entries, module_path, budget):
    """Round-robin over areas so one big folder cannot use up the whole budget.

    `entries` are (path, estimated_chars). Returns the picked paths in area order.
    """
    paths = [p for p, _ in entries]
    depth = _grouping_depth(paths, module_path)
    areas: dict[str, list] = {}
    for path, size in sorted(entries, key=lambda e: (_rank(e[0]), e[0])):
        areas.setdefault(_group_of(path, module_path, depth), []).append((path, size))
    picked, used = [], 0
    # Product code from every area first; tests and migrations only with budget left.
    for allow_low in (False, True):
        queues = {
            area: [e for e in items if (_rank(e[0]) == 3) == allow_low]
            for area, items in areas.items()
        }
        while any(queues.values()) and len(picked) < MAX_FILES:
            for queue in queues.values():
                if not queue or len(picked) >= MAX_FILES:
                    continue
                path, size = queue.pop(0)
                if used + size > budget and picked:
                    continue
                picked.append(path)
                used += size
    order = {area: i for i, area in enumerate(areas)}
    picked.sort(key=lambda p: (order[_group_of(p, module_path, depth)], p))
    return picked, {p: _group_of(p, module_path, depth) for p in picked}


def _outline(paths, module_path):
    """Source files per folder, so the model sees the shape of the whole code base."""
    depth = _grouping_depth(paths, module_path)
    counts: dict[str, int] = {}
    for path in paths:
        area = _group_of(path, module_path, depth)
        counts[area] = counts.get(area, 0) + 1
    return [f"{area} ({n} files)" for area, n in sorted(counts.items())][:80]


def _sample_sources(name, sha, module_path):
    """The module's source code at a commit, spread across its areas, product code first."""
    items, truncated = _tree(name, sha)
    entries = [
        (
            item["path"],
            min(int(item.get("size") or MAX_CHARS_PER_FILE), MAX_CHARS_PER_FILE),
        )
        for item in items
        if item.get("type") == "blob"
        and _is_source(item.get("path", ""))
        and _in_module(item["path"], module_path)
        and int(item.get("size") or 0) <= MAX_FILE_BYTES
    ]
    picked, areas = _pick_across_areas(entries, module_path, PART_CHARS * MAX_PARTS)
    contents = _read_many(name, sha, picked)
    where = module_path or "the repository"
    notes = []
    if len(picked) < len(entries):
        notes.append(
            f"Read {len(picked)} of {len(entries)} source files in {where}, spread "
            "across every folder with product code first; pick a module for full detail."
        )
    else:
        notes.append(f"Read all {len(entries)} source files in {where}.")
    if truncated:
        notes.append(
            "GitHub returned a partial file list for this large repository, "
            "so some files were not considered."
        )
    sources = [
        {"path": p, "area": areas[p], "content": contents[p]}
        for p in picked
        if contents[p].strip()
    ]
    return sources, notes, _outline([p for p, _ in entries], module_path)


def _changed_sources(name, sha, files, module_path, label):
    """Changed source files with their diffs, largest product changes first."""
    changed = [
        f
        for f in files
        if _is_source(f["filename"])
        and f.get("status") != "removed"
        and _in_module(f["filename"], module_path)
    ]
    changed.sort(key=lambda f: (_rank(f["filename"]), -f.get("changes", 0)))
    picked, used = [], 0
    for f in changed:
        size = min(len(f.get("patch") or ""), MAX_PATCH_CHARS) + MAX_CHARS_PER_FILE // 2
        if len(picked) >= MAX_FILES or (
            picked and used + size > PART_CHARS * MAX_PARTS
        ):
            continue
        picked.append(f)
        used += size
    notes = (
        [f"Read {len(picked)} of {len(changed)} changed source files in {label}."]
        if len(changed) > len(picked)
        else [f"Read all {len(changed)} changed source files in {label}."]
    )
    contents = _read_many(name, sha, [f["filename"] for f in picked])
    depth = _grouping_depth([f["filename"] for f in picked], module_path)
    sources = [
        {
            "path": f["filename"],
            "area": _group_of(f["filename"], module_path, depth),
            "status": f.get("status", ""),
            "patch": (f.get("patch") or "")[:MAX_PATCH_CHARS],
            # With a diff in hand the start of the file is enough context.
            "content": contents[f["filename"]][: MAX_CHARS_PER_FILE // 2],
        }
        for f in picked
    ]
    return sources, notes, [f["filename"] for f in changed][:200]


def _no_changes(label, module_path):
    where = f" in {module_path}" if module_path else ""
    return HTTPException(422, f"{label} changes no source files{where}")


def _resolve(name, data):
    """The code to draft from: (kind, ref, commit, context, sources, notes, outline)."""
    module = data.module_path
    if data.pull_number:
        number = data.pull_number
        pull = github.call("GET", f"/repos/{name}/pulls/{number}")
        sha = pull["head"]["sha"]
        label = f"PR #{number}"
        sources, notes, outline = _changed_sources(
            name, sha, _pull_files(name, number), module, label
        )
        if not sources:
            raise _no_changes(label, module)
        context = (
            f"Pull request #{number}: {pull.get('title', '')}\n{pull.get('body') or ''}"
        )
        return "PULL", str(number), sha, context[:2000], sources, notes, outline
    if data.commit:
        commit = github.call("GET", f"/repos/{name}/commits/{data.commit}")
        sha = commit["sha"]
        label = f"commit {sha[:7]}"
        sources, notes, outline = _changed_sources(
            name, sha, commit.get("files", []), module, label
        )
        if not sources:
            raise _no_changes(label, module)
        message = (commit.get("commit") or {}).get("message", "")
        return (
            "COMMIT",
            sha,
            sha,
            f"Commit {sha[:7]}: {message}"[:2000],
            sources,
            notes,
            outline,
        )
    default = _default_branch(name)
    if data.branch and data.branch != default:
        sha = _branch_sha(name, data.branch)
        base = _branch_sha(name, default)
        # Compare by SHA so a branch name with slashes is never ambiguous.
        compare = github.call("GET", f"/repos/{name}/compare/{base}...{sha}")
        sources, notes, outline = _changed_sources(
            name,
            sha,
            compare.get("files", []),
            module,
            f"{data.branch} compared with {default}",
        )
        context = f"Changes on branch {data.branch} compared with {default}"
        if not sources:
            sources, notes, outline = _sample_sources(name, sha, module)
            notes.insert(
                0,
                f"{data.branch} has no source changes compared with {default}, "
                "so its files were read instead.",
            )
            context = f"Branch {data.branch}"
        return "BRANCH", data.branch, sha, context, sources, notes, outline
    sha = _branch_sha(name, default)
    sources, notes, outline = _sample_sources(name, sha, module)
    return (
        "DEFAULT",
        default,
        sha,
        f"Module {module or '(entire repository)'} on {default}",
        sources,
        notes,
        outline,
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


def _normalize_story(story, known_paths=None, existing=None):
    """One story from the model; `existing` maps project story ids to title and criteria."""
    if isinstance(story, str):
        story = {"title": story}
    if not isinstance(story, dict):
        return None
    existing_id = 0
    if existing:
        existing_id = _number(story.get("existing_story_id"), 0, 0, 2**31)
        existing_id = existing_id if existing_id in existing else 0
    title = (
        existing[existing_id]["title"]
        if existing_id
        else story.get("title") or story.get("summary") or story.get("name")
    )
    if not title:
        return None
    criteria_texts = (
        existing[existing_id]["criteria"]
        if existing_id
        else _text_list(story.get("acceptance_criteria") or story.get("criteria"))[
            :MAX_LIST
        ]
    )
    tests = [
        normalized
        for test in story.get("test_cases") or story.get("tests") or []
        if (normalized := _normalize_test(test, criteria_texts))
    ]
    # Only paths that were really sent, so a story never cites a file the model made up.
    files = [
        path
        for path in _text_list(story.get("source_files") or story.get("files"))
        if known_paths is None or path in known_paths
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
                "source_files": list(dict.fromkeys(files))[:20],
                "existing_issue_id": existing_id or None,
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


def _normalize_draft(raw, known_paths=None, existing=None):
    """Stories and notes from the model's answer, repaired rather than rejected."""
    raw = _unwrap(raw)
    stories = raw.get("user_stories") or raw.get("stories") or []
    if not isinstance(stories, list):
        stories = [stories]
    normalized = [
        story
        for item in stories
        if (story := _normalize_story(item, known_paths, existing))
    ][:MAX_STORIES]
    notes = _text_list(raw.get("notes"))
    notes.append("Review and approve each item before saving it into the project.")
    return normalized, notes


COVERAGE_TEXT = {
    "POSITIVE": "positive (the happy path works)",
    "NEGATIVE": "negative (invalid input, missing permission, failures are handled)",
    "BOUNDARY": "boundary (empty, minimum and maximum values, limits)",
    "VALIDATION": "validation (required fields, formats and the exact error messages)",
}


def _schema(output_type, with_existing):
    """The JSON shape asked of the model; tests are left out for stories-only drafts."""
    test = {
        "title": "Positive | Negative | Boundary | Validation: what the test proves",
        "test_type": "FUNCTIONAL | REGRESSION | INTEGRATION | UI | API",
        "priority": "LOW | MEDIUM | HIGH | CRITICAL",
        "covers": ["index (from 0) of each acceptance criterion this test proves"],
        "preconditions": "string",
        "test_data": "string",
        "expected_result": "string",
        "steps": [
            {"action": "string", "test_data": "string", "expected_result": "string"}
        ],
    }
    story = {
        "title": "short name of the user-facing capability",
        "description": "As a <role>, I want <goal> so that <benefit>",
        "priority": "LOW | MEDIUM | HIGH | CRITICAL",
        "story_points": "integer from 1 to 13",
        "source_files": ["path of each file this story is based on, exactly as given"],
        "acceptance_criteria": ["specific, testable statement taken from the code"],
    }
    if with_existing:
        story = {
            "existing_story_id": "id from existing_stories that these tests verify, or null",
            **story,
        }
    if output_type != "USER_STORIES":
        story["test_cases"] = [test]
    return {"user_stories": [story], "notes": ["string"]}


def _rules(data, changed, part, parts, with_existing):
    rules = [
        "You are a senior business analyst and QA engineer documenting an application "
        "from its source code.",
        "Describe the behavior the code implements for its users: screens, forms, "
        "fields, buttons, API endpoints, validations, limits, permissions, roles, "
        "states and messages.",
        "Base every story, acceptance criterion and test step on something the code in "
        "'sources' actually does, using the real names, fields, routes, limits and "
        "messages you see. Do not invent features, screens or rules that are not in "
        "the code.",
        "Ignore build, configuration, styling and test-only code unless it changes "
        "what users see or can do.",
        "Write one story per user capability, grouping related files; do not write "
        "one story per file and do not repeat a story.",
        "In source_files list the paths, exactly as given, of the files each story is "
        "based on.",
        "Write acceptance criteria as specific, testable statements and keep each one "
        "under the story it belongs to.",
        "If the code is too thin to describe a capability with confidence, leave it out "
        "and say so in notes.",
    ]
    if changed:
        rules.append(
            "The sources are the files this change touched: 'patch' is the unified diff "
            "and 'content' the start of the file after the change. Describe only the "
            "behavior the change adds or alters, not the rest of the file."
        )
    if parts > 1:
        rules.append(
            f"This is part {part} of {parts} of the code; 'outline' lists every area of "
            "the code base for context. Cover only the behavior in this part's sources."
        )
    if data.output_type == "USER_STORIES":
        rules.append(
            "Write user stories with acceptance criteria only. Do not write test cases."
        )
    else:
        kinds = data.coverage or ["POSITIVE"]
        rules += [
            "Write manual test cases a tester can follow in the running application "
            "(UI or API): concrete steps, real test data (field values, limits, roles) "
            "and the exact expected result, quoting messages from the code where they "
            "exist.",
            "Write test cases only for these coverage kinds: "
            + "; ".join(COVERAGE_TEXT[k] for k in kinds)
            + ". Start each test title with its kind, e.g. 'Negative: ...'.",
            "In covers, list the indexes (from 0) of the acceptance criteria each test "
            "proves.",
        ]
        if data.output_type == "TEST_CASES":
            rules.append(
                "The goal is test cases. 'existing_stories' lists the project's stories: "
                "put each test under the existing story it verifies by setting "
                "existing_story_id, with covers indexing that story's acceptance "
                "criteria. Only when no existing story fits, add a new story (title, "
                "description, acceptance_criteria) to hold the tests."
                if with_existing
                else "The goal is test cases. Add a short story with acceptance criteria "
                "to hold each group of related tests."
            )
        else:
            rules.append(
                "Write user stories with acceptance criteria, and test cases for each "
                "story."
            )
    rules += [
        "Write at most 10 user stories in this part, 8 acceptance criteria per story, "
        "6 test cases per story and 12 steps per test case.",
        "Use exactly one of the listed words for priority and test_type.",
        "Respond with a single JSON object shaped exactly like the request's "
        '"schema" value, with user_stories and notes at the top level. '
        "Do not echo the request.",
    ]
    return rules


def _parts(sources):
    """Sources split into request-sized parts, keeping each area's files together."""
    parts, current, size = [], [], 0
    for source in sources:
        length = len(source.get("content", "")) + len(source.get("patch", ""))
        if current and size + length > PART_CHARS:
            parts.append(current)
            current, size = [], 0
        current.append(source)
        size += length
    if current:
        parts.append(current)
    while len(parts) > MAX_PARTS:
        parts[-2].extend(parts.pop())
    return parts


def _openai_error(response):
    status = response.status_code
    if status == 401:
        return "OpenAI rejected the API key."
    if status == 429:
        return "OpenAI rate limit or quota was reached."
    if status == 404:
        return f"OpenAI does not offer the model {settings.openai_model} to this key."
    return f"OpenAI returned error {status}."


def _ask_openai(rules, prompt):
    """(answer, None) or (None, reason) for one request."""
    body = {
        "model": settings.openai_model,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": " ".join(rules)},
            {"role": "user", "content": json.dumps(prompt)},
        ],
    }
    # Reasoning models only accept their default temperature.
    if settings.openai_model.startswith("gpt-4"):
        body["temperature"] = 0.2
    try:
        response = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            timeout=OPENAI_TIMEOUT,
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json=body,
        )
    except httpx.TimeoutException:
        return None, f"OpenAI did not answer within {OPENAI_TIMEOUT} seconds."
    except httpx.HTTPError:
        return None, "Could not reach OpenAI."
    if response.status_code >= 400:
        return None, _openai_error(response)
    try:
        return json.loads(response.json()["choices"][0]["message"]["content"]), None
    except (KeyError, IndexError, ValueError, TypeError):
        return None, "OpenAI's answer could not be read."


def _merge(stories):
    """One story per capability across parts; tests for the same existing story combine."""
    merged = {}
    for story in stories:
        key = (
            f"id:{story.existing_issue_id}"
            if story.existing_issue_id
            else re.sub(r"[^a-z0-9]+", " ", story.title.lower()).strip()
        )
        if key not in merged:
            merged[key] = story
            continue
        kept = merged[key]
        # Test `covers` index the story's criteria, so only combine identical lists.
        if kept.acceptance_criteria == story.acceptance_criteria:
            kept.test_cases = (kept.test_cases + story.test_cases)[:MAX_LIST]
        kept.source_files = list(dict.fromkeys(kept.source_files + story.source_files))[
            :20
        ]
    return list(merged.values())[:MAX_STORIES]


def _shape(stories, output_type):
    """Hold the draft to the requested output, whatever the model sent."""
    if output_type == "USER_STORIES":
        for story in stories:
            story.test_cases = []
        return [story for story in stories if not story.existing_issue_id]
    if output_type == "TEST_CASES":
        return [story for story in stories if story.test_cases]
    return stories


def _openai_draft(project, repo, data, sources, context, outline, existing):
    """(stories, notes) from OpenAI, or (None, reason) when no usable draft came back."""
    if not settings.openai_api_key:
        return None, "OpenAI is not configured (no OPENAI_API_KEY)."
    if not sources:
        return None, "No source files were found to read."
    changed = any("patch" in source for source in sources)
    parts = _parts(sources)
    with_existing = data.output_type == "TEST_CASES" and bool(existing)
    schema = _schema(data.output_type, with_existing)

    def draft(numbered):
        index, part = numbered
        prompt = {
            "repository": repo,
            "project": project.name,
            "source": context,
            "module_path": data.module_path,
            "output_type": data.output_type,
            "coverage": data.coverage,
            "outline": outline,
            "part": f"{index + 1} of {len(parts)}",
            "sources": [
                {k: v for k, v in source.items() if k != "area"} for source in part
            ],
            "schema": schema,
        }
        if with_existing:
            prompt["existing_stories"] = [
                {
                    "id": id,
                    "title": item["title"],
                    "acceptance_criteria": item["criteria"],
                }
                for id, item in existing.items()
            ]
        answer, error = _ask_openai(
            _rules(data, changed, index + 1, len(parts), with_existing), prompt
        )
        if answer is None:
            return None, error
        stories, notes = _normalize_draft(
            answer,
            {source["path"] for source in part},
            existing if with_existing else None,
        )
        if not stories:
            return None, "OpenAI returned no usable user stories for these files."
        return stories, notes

    with ThreadPoolExecutor(max_workers=len(parts)) as pool:
        results = list(pool.map(draft, enumerate(parts)))
    stories, notes = [], []
    for index, (found, extra) in enumerate(results):
        if found is None:
            areas = ", ".join(sorted({s["area"] for s in parts[index]})[:3])
            notes.append(f"Part {index + 1} ({areas}) was not drafted: {extra}")
            continue
        stories.extend(found)
        notes.extend(note for note in extra if note not in notes)
    if not stories:
        return None, results[0][1]
    stories = _shape(_merge(stories), data.output_type)
    if not stories:
        return None, "OpenAI returned nothing for the requested output."
    if len(parts) > 1:
        notes.insert(
            0,
            f"Drafted with {settings.openai_model} in {len(parts)} parts that were "
            "read in parallel and combined.",
        )
    return stories, notes


def _existing_stories(db, project_id):
    """The project's stories and their criteria, so generated tests can join them."""
    stories = db.scalars(
        select(Issue)
        .where(Issue.project_id == project_id, Issue.issue_type == "STORY")
        .order_by(Issue.id.desc())
        .limit(80)
    )
    return {
        issue.id: {
            "title": issue.summary,
            "criteria": [
                c.description
                for c in sorted(
                    issue.acceptance_criteria, key=lambda c: (c.order_index, c.id)
                )
            ][:MAX_LIST],
        }
        for issue in stories
    }


def generate(db, actor, data):
    project, name = _repo(db, actor, data.project_id, data.repository or None)
    kind, ref, sha, context, sources, source_notes, outline = _resolve(name, data)
    existing = (
        _existing_stories(db, project.id) if data.output_type == "TEST_CASES" else {}
    )
    stories, notes = _openai_draft(
        project, name, data, sources, context, outline, existing
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
    updated_issue_ids = []
    test_case_ids = []
    for index, story in enumerate(data.user_stories):
        if index not in selected:
            continue
        existing = (
            db.get(Issue, story.existing_issue_id) if story.existing_issue_id else None
        )
        if (
            existing
            and existing.project_id == data.project_id
            and existing.issue_type == "STORY"
        ):
            # Tests join a story already in the project, against its own criteria.
            issue = existing
            updated_issue_ids.append(issue.id)
            criterion_ids = [
                c.id
                for c in sorted(
                    issue.acceptance_criteria, key=lambda c: (c.order_index, c.id)
                )
            ][:MAX_LIST]
        else:
            description = story.description
            if story.source_files:
                description += "\n\nGenerated from: " + ", ".join(story.source_files)
            issue = issues.create(
                db,
                IssueIn(
                    project_id=data.project_id,
                    issue_type="STORY",
                    summary=story.title,
                    description=description.strip(),
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
    return {
        "issue_ids": issue_ids,
        "updated_issue_ids": updated_issue_ids,
        "test_case_ids": test_case_ids,
    }


def suggestions(db, actor, project_id):
    """Generated items whose own source (branch, pull request or module) has changed.

    Each item is checked against the linked repository it was generated from.
    """
    project, primary = _repo(db, actor, project_id)
    linked = {r.full_name.lower(): r.full_name for r in project.repositories}
    defaults: dict[str, str] = {}
    heads: dict[tuple[str, str, str], str | None] = {}
    moved: dict[tuple[str, str, str, str], bool] = {}

    def default_branch(name):
        if name not in defaults:
            defaults[name] = _default_branch(name)
        return defaults[name]

    def head(name, kind, ref):
        key = (name, kind, ref)
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

    def changed(name, old, new, module_path):
        if old == new:
            return False
        key = (name, old, new, module_path)
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
        # Items from a repository that is no longer linked are not checked.
        name = linked.get((source.get("repository") or "").lower())
        if not name or not commit:
            return False
        kind = source.get("source_kind") or "DEFAULT"
        ref = source.get("source_ref") or default_branch(name)
        current = head(name, kind, ref)
        if current and changed(name, commit, current, source.get("module_path", "")):
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
    current = head(primary, "DEFAULT", default_branch(primary))
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
