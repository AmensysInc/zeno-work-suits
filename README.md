# Trackly

A local, full-stack project tracker built with React, TypeScript and FastAPI. PostgreSQL is the source of truth; the frontend uses real APIs throughout.

## Features

- JWT sign-in and registration with bcrypt password hashing.
- Multiple projects, project membership, owner-only project settings and deletion.
- Epics, stories, tasks, bugs and subtasks; automatic project issue keys; Markdown descriptions, labels, priorities, assignees, points and due dates.
- Epic-grouped backlog. “Plan issues” opens drag-and-drop sprint/backlog planning and ordering; dropdowns provide an alternative to dragging.
- Story acceptance criteria: add, edit, reorder, complete and delete.
- Planned, active and completed sprints. One active sprint per project. Completing a sprint returns unfinished work to the backlog and retains completed work in sprint history.
- Five-column Kanban board with persisted drag-and-drop status changes and optimistic updates with rollback.
- Test cases linked to stories, editable/reorderable test steps, results, and prefilled bugs linked to both their story and failed test.
- Comments with author-only editing/deletion and issue activity history.
- Dashboard counts, status/type charts, recent issues, global search, and My Issues.
- Responsive sidebar, loading/error/empty states, accessible dialogs, and save notifications.

## Prerequisites

- Node.js 20.19+ (or 22.12+) and npm.
- Python 3.12 and pip.
- Docker Desktop with its engine running, or PostgreSQL 16+ installed separately.

## Quick start

Run commands from the `trackly` directory unless indicated otherwise.

### PostgreSQL

```sh
docker compose up -d
docker compose ps
```

The database listens only on `127.0.0.1:5433`, with database/user `trackly` and development password `trackly_dev`. Data persists in the named `trackly_data` volume. `docker compose stop` stops it without deleting data. Optional Compose overrides `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` can be set in a root `.env`; match backend `DATABASE_URL` to any changes.

For an existing PostgreSQL installation, create a database and role and set `DATABASE_URL`; Docker is not otherwise required.

### Backend

```sh
cd backend
python -m venv .venv
```

Activate on Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
Copy-Item .env.example .env
```

On macOS/Linux:

```sh
source .venv/bin/activate
cp .env.example .env
```

Generate a signing secret and replace `JWT_SECRET` in `.env`:

```sh
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Then:

```sh
pip install -r requirements.txt
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If PowerShell activation is restricted, invoke `.venv\Scripts\python.exe`, `.venv\Scripts\alembic.exe`, and `.venv\Scripts\uvicorn.exe` directly. No policy change is needed.

API documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs). Health: `/api/health`.

### Frontend

Open a second terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Vite proxies `/api` to port 8000.

Demo credentials, created only by the explicit seed command:

| Email | Password |
|---|---|
| alex@trackly.demo | Trackly123! |
| nina@trackly.demo | Trackly123! |
| sam@trackly.demo | Trackly123! |

The seed command is idempotent and does not reset existing work. It creates Quick HRMS, Leave Management, the requested issues, Sprint 13 and four tests linked to HRMS-124. New registered users start with an empty workspace. Project owners can add an existing registered teammate through the Members tab.

## Environment variables

Backend reads `backend/.env` relative to its working directory:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLAlchemy URL, e.g. `postgresql+psycopg://trackly:trackly_dev@127.0.0.1:5433/trackly` |
| `JWT_SECRET` | Required secret for HS256 signing; use a long random value |
| `CORS_ORIGINS` | JSON array of allowed frontend origins; defaults to localhost/127.0.0.1 port 5173 |

Frontend optionally reads `frontend/.env`:

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Defaults to `/api`; set to an API URL when hosting frontend separately |

JWT access tokens expire after eight hours. The browser stores the token locally, clears it on sign-out, and redirects to sign-in on authentication failure. This MVP does not include password recovery, refresh tokens, email delivery or file uploads.

## Project structure

```text
trackly/
  docker-compose.yml
  backend/
    app/
      main.py
      core/         # configuration and password/JWT helpers
      api/          # typed routes and authentication dependencies
      models/       # SQLAlchemy entities and relationships
      schemas/      # Pydantic request/response validation
      services/     # access checks, lifecycle rules, writes and history
      db/           # engine and injected sessions
      migrations/   # Alembic revisions
      seed.py
    scripts/verify_postgres.py
    tests/
  frontend/
    src/
      components/   # layout, issues, sprints, board, testing, shadcn-style UI
      pages/
      routes/
      hooks/
      services/
      types/
      lib/
    public/assets/  # downloaded Figma assets
```

UI primitives use the shadcn/ui approach: editable local Button/Dialog components, Radix primitives, CVA variants and Tailwind utilities. The design uses Inter with local font files, blue primary color, subtle borders and the supplied Figma layouts. Extra controls implement the brief's functionality. Figma's MCP plan limit prevented detailed retrieval of the sprint-planning and story-detail screens; those views follow the written requirements and shared design system.

## Validation and migrations

Backend:

```sh
cd backend
pytest -q
alembic current
alembic check
```

Tests use isolated in-memory SQLite databases with foreign-key enforcement. They cover authentication, access isolation, cross-project link validation, criteria ordering, sprint lifecycle, issue movement, test steps, bug/test relations, comment ownership and activity history.

To verify actual PostgreSQL migrations in an automatically created disposable database (the configured database role needs `CREATEDB`):

```sh
python scripts/verify_postgres.py
```

This runs upgrade → schema check → downgrade → upgrade → schema check and checks the circular issue/test foreign key, then removes only its temporary verification database.

For future model changes:

```sh
alembic revision --autogenerate -m "describe change"
# Review the generated revision, especially circular foreign keys.
alembic upgrade head
alembic check
```

`alembic downgrade -1` rolls back one revision; use a database backup before rolling back real data.

Frontend:

```sh
cd frontend
npm run typecheck
npm run lint
npm run build
npm run format
```

Optional Python formatter:

```sh
pip install -r requirements-dev.txt
black app tests scripts
```

## Deployment notes

This deliverable is a local development MVP; it is not published. For deployment, serve `frontend/dist` with SPA fallback, proxy `/api` to FastAPI, use a managed PostgreSQL database, configure HTTPS and allowed origins, and replace demo credentials/secrets. Run migrations as a release step. The Compose configuration intentionally exposes only PostgreSQL to the loopback interface.

## Troubleshooting

- Docker pipe/engine error: start Docker Desktop, wait for its engine, then rerun `docker compose up -d`.
- Database connection problem: use `127.0.0.1`, verify port `5433` and `docker compose ps`, and run backend commands from `backend/`.
- Empty new account: create a project or ask its owner to add your registered email.
- Empty board: start a planned sprint in Backlog or Sprints.
- Port 5173 occupied: stop the other service or change Vite's port and update CORS origins.
- Authentication expired: sign in again.

See `VERIFICATION.md` for checks performed on the delivered version.
