# Trackly verification

Verified locally on Windows on 7 October 2026.

## Automated checks

- Backend: `pytest -q` — 10 tests passed. Covers authentication, access isolation, link validation, acceptance criteria ordering, sprint lifecycle, movement into active sprints, test steps and bug links, comments and activity.
- Frontend: `npm run typecheck`, `npm run lint`, and `npm run build` — passed.
- PostgreSQL: Alembic upgrade, schema comparison, downgrade and re-upgrade passed in a disposable database. The circular issue/test foreign key is present.
- Live PostgreSQL API smoke checks passed: ten concurrent issue creations generated unique keys; sprint lifecycle and persistence worked; deleting a linked test cleared its bug foreign key; temporary project cleanup succeeded.
- API health endpoint returned `status: ok`.

The backend tests emit one upstream AnyIO/Starlette deprecation warning; no tests failed.

## Browser checks

- Signed in with the seeded demo account and loaded dashboard data.
- Started Sprint 13 and used the five-column board.
- Dragged an issue from Code Review to Testing and verified persistence.
- Dragged a backlog issue into a sprint and confirmed its allocation after reloading.
- Created a bug from a failed test with the story and test links prefilled; edited its epic.
- Created a test case with steps and verified its saved detail page.
- Added a comment and verified the issue activity.
- Inspected desktop layout at 1440px and tablet layout at 820px. The tablet sidebar expands/collapses, and the inspected page had no horizontal overflow.
- Verified downloaded Figma SVG assets load at their intended dimensions.

The demo database retains the sample changes made during browser verification. The seed command does not reset existing work.

## Scope and limits

This is a local development MVP, not a published service. Browser workflows above were manually verified; there is no automated browser test suite. Figma's plan quota prevented detailed retrieval of the sprint-planning and story-detail frames. Those screens use the written brief and shared design styles, so exact visual parity with those two frames is unverified.

The source archive excludes dependencies, build output, caches and local secrets. Follow README.md to install dependencies and create a fresh environment.
