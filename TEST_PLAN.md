# Zeno Work Suite — Test Plan

Detailed manual and automated test plan for the whole application (backend API + React frontend).
Each test case has an ID, steps, and expected result. Mark **Result** as Pass / Fail / Blocked and note the build or commit tested.

---

## 1. Scope

| Area | In scope |
|---|---|
| Authentication | Register, login, session (JWT, 8 h), logout, 401 handling |
| Projects | Create, edit, archive, delete, members, access isolation |
| Issues | Epic / Story / Task / Bug / Subtask, links, statuses, ordering, labels |
| Acceptance criteria | Add, edit, delete, reorder (stories only) |
| Sprints & planning | Create, edit, start, complete, backlog drag-and-drop |
| Kanban board | Drag between columns, persistence |
| Comments & activity | Add, edit, delete own comments, activity log |
| QA — Test cases | Repository, steps, shared steps, criteria coverage |
| QA — Executions | Run test, step results, history, status sync |
| QA — Dashboards | QA Dashboard, QA Execution Board, Bugs, Traceability |
| Voice Agent | Record, upload to Sonix, transcript, create issue |
| Non-functional | Validation, security, responsive layout, error handling, performance |

Out of scope: load testing at production scale, Sonix internal accuracy.

---

## 2. Test environment

| Item | Value |
|---|---|
| Frontend | http://127.0.0.1:5173 (Vite dev server, proxies `/api` → :8000) |
| Backend | http://127.0.0.1:8000 — Swagger at `/docs`, health at `/api/health` |
| Database | PostgreSQL 16 in Docker (`trackly-db-1`), port 5433, DB `trackly` |
| Browsers | Chrome (latest) primary; Edge, Firefox secondary |
| Viewports | 1440 px desktop, 820 px tablet, 390 px mobile |

### Setup

```bash
docker compose up -d                     # Postgres
cd backend
.venv\Scripts\alembic upgrade head
.venv\Scripts\python -m app.seed         # demo data (does not reset existing data)
.venv\Scripts\uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
cd ../frontend && npm run dev
```

### Test data (seed)

| User | Email | Role in seed |
|---|---|---|
| Alex Rivera | alex@trackly.demo | Owner of project **HRMS** |
| Nina Kim | nina@trackly.demo | Member of HRMS |
| Sam Patel | sam@trackly.demo | Member of HRMS |

Password for all: see `backend/app/seed.py` (line 191).
Seed also creates project **Quick HRMS (HRMS)**, planned **Sprint 13** (19–30 Oct 2026), an epic, stories HRMS-100+, and test cases TC-001…TC-004.

For isolation tests, register an extra user **outsider@test.local** who is not a member of HRMS.

---

## 3. Automated tests

| ID | Command | Expected |
|---|---|---|
| AUTO-01 | `cd backend && .venv\Scripts\pytest -q` | All tests pass (8 test files: auth, issues, sprints, criteria, comments, testing, validation, qa) |
| AUTO-02 | `cd frontend && npm run typecheck` | No TypeScript errors |
| AUTO-03 | `cd frontend && npm run lint` | No lint errors |
| AUTO-04 | `cd frontend && npm run build` | Build succeeds |
| AUTO-05 | `cd backend && .venv\Scripts\python scripts/verify_postgres.py` | Upgrade, schema compare, downgrade, re-upgrade pass on a disposable DB |
| AUTO-06 | `GET /api/health` | `200 {"status":"ok"}` |

---

## 4. Functional test cases

### 4.1 Authentication

| ID | Title | Steps | Expected |
|---|---|---|---|
| AUTH-01 | Login success | Open `/login`, enter alex@trackly.demo + seed password, Sign in | Redirect to `/dashboard`; name shown in profile menu |
| AUTH-02 | Wrong password | Valid email, wrong password | Error "Incorrect email or password"; stays on login |
| AUTH-03 | Unknown email | Email not registered | Same error as AUTH-02 (no user enumeration) |
| AUTH-04 | Password too short | Password with 7 chars | Validation error (min 8) |
| AUTH-05 | Password too long | Password > 72 bytes | Validation error "Password must be at most 72 bytes" |
| AUTH-06 | Invalid email format | `abc@` | Validation error |
| AUTH-07 | Register success | Switch to Register, fill first/last name, new email, password ≥ 8 | Account created, logged in, lands on dashboard |
| AUTH-08 | Register duplicate email | Register with alex@trackly.demo | 409 "Email already registered" |
| AUTH-09 | Register empty name | Leave first name blank | Validation error |
| AUTH-10 | Session persists | Log in, reload page | Still logged in (token in localStorage `trackly_token`) |
| AUTH-11 | Logout | Profile menu → Log out | Redirect to `/login`; protected pages redirect to login |
| AUTH-12 | Protected route without login | Clear localStorage, open `/projects` | Redirect to `/login` |
| AUTH-13 | Expired / invalid token | Set `trackly_token` to garbage, reload | API returns 401 → app redirects to `/login` |
| AUTH-14 | `/auth/me` | Call with valid token | Returns current user, no password hash |

### 4.2 Projects

| ID | Title | Steps | Expected |
|---|---|---|---|
| PRJ-01 | List projects | Open `/projects` as Alex | HRMS visible |
| PRJ-02 | Create project | New project: key `QA1`, name "QA Project" | Created; creator is owner and member |
| PRJ-03 | Invalid key | Key `qa`, `1AB`, `A`, `ABCDEFGHIJK` | Rejected (must match `^[A-Z][A-Z0-9]{1,9}$`) |
| PRJ-04 | Duplicate key | Create another project with key `HRMS` | 409 "Project key already exists" |
| PRJ-05 | Edit project | Owner edits name/description | Saved and shown |
| PRJ-06 | Archive project | Owner sets status ARCHIVED | Status shown as archived |
| PRJ-07 | Add member | Owner adds nina@trackly.demo to QA1 | Nina sees QA1 after login |
| PRJ-08 | Add unknown member | Add `nobody@x.com` | 404 "No registered user with that email" |
| PRJ-09 | Non-owner edit | Log in as Nina, edit HRMS | 403 "Only the project owner can do this" |
| PRJ-10 | Non-owner delete | As Nina, delete HRMS | 403 |
| PRJ-11 | Isolation | As outsider, open `/projects/<HRMS id>` | 404 "Project not found"; HRMS not listed |
| PRJ-12 | Delete project | Owner deletes QA1 | Removed with its issues, sprints, tests |
| PRJ-13 | Current project memory | Switch project in sidebar, reload | Same project selected (localStorage `trackly_project`) |

### 4.3 Issues

| ID | Title | Steps | Expected |
|---|---|---|---|
| ISS-01 | Create story | Create issue → Story under an epic | Key `HRMS-<next>` auto-generated |
| ISS-02 | Create each type | Create Epic, Task, Bug, Subtask (with parent) | All saved with correct type icon |
| ISS-03 | Story without epic | Create story, no epic | 422 "Choose an epic for a non-epic issue" |
| ISS-04 | Subtask without parent | Subtask, no parent | 422 "A subtask needs a parent" |
| ISS-05 | Subtask under epic/subtask | Parent = epic | 422 "Subtasks require a story, task or bug parent" |
| ISS-06 | Self link | Edit issue, set parent/related to itself | 422 "An issue cannot link to itself" |
| ISS-07 | Cross-project link | Link to issue from another project | 422 "Linked issues must belong to this project" |
| ISS-08 | Assignee not member | Assign outsider | 422 "Assignee must be a project member" |
| ISS-09 | Epic in sprint | Put an epic in a sprint | 422 "Epics cannot be assigned to a sprint" |
| ISS-10 | Completed sprint | Assign issue to completed sprint | 422 "Choose an open sprint in this project" |
| ISS-11 | Active sprint moves status | Add BACKLOG issue to the active sprint | Status becomes TODO |
| ISS-12 | Date order | Due date before start date | 422 "Due date must be on or after start date" |
| ISS-13 | Summary limits | Empty summary; 301 chars | Rejected |
| ISS-14 | Story points | -1 and 1001 | Rejected (0–1000) |
| ISS-15 | Labels | Add 31 labels | Rejected (max 30) |
| ISS-16 | Edit issue | Change summary, priority, assignee | Saved; activity entry added |
| ISS-17 | Change status | PATCH status through all 6 values | Each saved; activity logged |
| ISS-18 | Delete issue | Delete a task | Removed; 404 on reopen |
| ISS-19 | Unique keys under load | Create 10 issues concurrently (API) | 10 distinct keys, no gaps/duplicates |
| ISS-20 | Issue isolation | Outsider GET `/api/issues/<id>` | 404 "Issue not found" |
| ISS-21 | Issue detail tabs | Open issue → Overview, Subtasks, Tests, Comments, Activity | Each tab loads correct data |
| ISS-22 | My Issues | Open `/my-issues` | Only issues assigned to current user |
| ISS-23 | Search | Use top search | Matching issues listed |
| ISS-24 | Null required field | PUT with `"issue_type": null` | 422 "issue_type cannot be null" |

### 4.4 Acceptance criteria

| ID | Title | Steps | Expected |
|---|---|---|---|
| AC-01 | Add criterion | Story → Overview → add criterion | Saved, numbered |
| AC-02 | Non-story | Add criterion to a task | 422 "Acceptance criteria belong to stories" |
| AC-03 | Edit / delete | Edit text, then delete | Updated / removed |
| AC-04 | Reorder | Drag to reorder | Order persists after reload |
| AC-05 | Bad reorder | API reorder missing one id or duplicate | 422 "Provide every criterion exactly once" |
| AC-06 | Empty / long text | Empty; 5001 chars | Rejected |

### 4.5 Sprints and backlog

| ID | Title | Steps | Expected |
|---|---|---|---|
| SPR-01 | Create sprint | Backlog → Create sprint (name, dates, capacity) | Appears as PLANNED |
| SPR-02 | End before start | End date < start date | "End date must be on or after start date" |
| SPR-03 | Capacity bounds | 0 and 10001 | Rejected |
| SPR-04 | Start without dates | Start a sprint with no dates | 422 "Set start and end dates before starting" |
| SPR-05 | Start sprint | Start Sprint 13 | ACTIVE; board shows its issues |
| SPR-06 | Two active sprints | Start another while one active | 409 "Complete the current active sprint first" |
| SPR-07 | Start non-planned | Start an ACTIVE/COMPLETED sprint | 409 "Only a planned sprint can start" |
| SPR-08 | Complete sprint | Complete active sprint with unfinished issues | COMPLETED; unfinished issues return to backlog |
| SPR-09 | Complete non-active | Complete a planned sprint | 409 "Only an active sprint can complete" |
| SPR-10 | Edit completed | Edit completed sprint | 409 "Completed sprints cannot be edited" |
| SPR-11 | Drag backlog → sprint | Drag issue into sprint | Allocated; persists after reload |
| SPR-12 | Reorder backlog | Drag to reorder | Order persists (order_index) |
| SPR-13 | Capacity indicator | Add points beyond capacity | Over-capacity shown |

### 4.6 Kanban board

| ID | Title | Steps | Expected |
|---|---|---|---|
| BRD-01 | Columns | Open board with active sprint | Columns TODO, In Progress, Code Review, Testing, Done |
| BRD-02 | Drag card | Move card to another column | Moves instantly (optimistic); persists after reload |
| BRD-03 | Failed move rollback | Stop backend, drag a card | Card returns to original column; error toast |
| BRD-04 | No active sprint | Board with no active sprint | Helpful empty state |
| BRD-05 | Open card | Click card | Navigates to issue details |

### 4.7 Comments and activity

| ID | Title | Steps | Expected |
|---|---|---|---|
| COM-01 | Add comment | Issue → Comments → post | Shown with author and time |
| COM-02 | Edit own | Edit own comment | Updated |
| COM-03 | Edit others | As Nina, edit Alex's comment | 403 "You can only edit or delete your own comments" |
| COM-04 | Delete own | Delete own comment | Removed |
| COM-05 | Empty / too long | Empty; 20001 chars | Rejected |
| COM-06 | Activity log | Create, edit, change status | Each recorded in Activity tab, newest first |

### 4.8 Test cases (QA)

| ID | Title | Steps | Expected |
|---|---|---|---|
| TC-01 | Repository | Open `/test-cases` | TC-001…TC-004 listed with status |
| TC-02 | Create test case | Add test case linked to a story, 3 steps | Key `TC-<next>`; status NOT_RUN |
| TC-03 | Step without action | Step with empty action | 422 "Step N needs an action" |
| TC-04 | Change linked story | Edit saved test, change story | 422 "A saved test case cannot change its linked story" |
| TC-05 | Cover criteria | Select acceptance criteria of the story | Saved; shown in traceability |
| TC-06 | Test type | Each of FUNCTIONAL, REGRESSION, INTEGRATION, UI, API | Saved |
| TC-07 | Delete test case | Delete one linked from a bug | Deleted; bug's test link cleared |
| TC-08 | Detail page | Open test case | Steps, criteria, execution history shown |
| TC-09 | Limits | Title 301 chars; 101 steps | Rejected |

### 4.9 Shared (reusable) steps

| ID | Title | Steps | Expected |
|---|---|---|---|
| SS-01 | Create shared step | Library → new (title, action, expected) | Listed |
| SS-02 | Use in test case | Insert shared step in a test | Step filled from library |
| SS-03 | Edit propagates | Edit shared step | All test cases using it updated |
| SS-04 | Wrong project | Use step from another project | 422 "Reusable steps must belong to this project" |
| SS-05 | Move project | API change project_id | 422 "A reusable step cannot move between projects" |
| SS-06 | Delete | Delete shared step | Removed from library; existing test steps keep text |

### 4.10 Test executions

| ID | Title | Steps | Expected |
|---|---|---|---|
| EX-01 | Run test | Test case → Run → mark steps, overall PASSED | Execution saved; test status PASSED |
| EX-02 | Failed run | Mark a step FAILED, overall FAILED | Status FAILED; "Create bug" offered |
| EX-03 | Bug from failed run | Create bug from run | Bug prefilled with story, test case and run links |
| EX-04 | Default sprint | Run with active sprint | Execution attached to active sprint |
| EX-05 | Wrong sprint | Sprint from another project | 422 "Choose a sprint in this project" |
| EX-06 | Tester not member | tester_id = outsider | 422 "Tester must be a project member" |
| EX-07 | Duplicate step result | Same step twice | 422 "Record each step result once" |
| EX-08 | Unknown step | step_number not in test | 422 "Step results must match the test case steps" |
| EX-09 | Move run | Change test_case_id on edit | 422 "A test run cannot move to another test case" |
| EX-10 | Snapshot | Run test, then edit test steps | Old run still shows original steps |
| EX-11 | Status sync | Delete latest run | Test status = previous run, or NOT_RUN |
| EX-12 | History | Several runs | Listed newest first with tester and date |
| EX-13 | Bug link mismatch | Bug with run from a different test case | 422 "Bug test run and test case links must match" |

### 4.11 QA dashboards and traceability

| ID | Title | Steps | Expected |
|---|---|---|---|
| QA-01 | QA Dashboard | Open project → Quality | Pass rate, counts by status, recent runs correct |
| QA-02 | QA Execution Board | Drag test to PASSED / FAILED column | Run dialog opens; result saved on confirm |
| QA-03 | Cancel drop | Drag, then cancel dialog | No run created; card returns |
| QA-04 | Bugs page | Open Bugs | All bugs with linked story/test/run |
| QA-05 | Traceability | Open Traceability | One row per story: criteria → tests → last run → bugs |
| QA-06 | Story health | Story with all tests passing / failing / none / not run | READY / AT_RISK / GAP / NOT_RUN |
| QA-07 | Traceability isolation | Outsider calls `/api/projects/<HRMS>/traceability` | 404 |

### 4.12 Voice Agent

| ID | Title | Steps | Expected |
|---|---|---|---|
| VA-01 | Mic permission denied | Block mic, Start recording | "Microphone access was blocked. Allow it in your browser." |
| VA-02 | Record & stop | Allow mic, record 5 s, stop | Timer counts; "Uploading to Sonix…" |
| VA-03 | Transcribe | Wait | "Transcribing…" then transcript shown; toast "Transcript ready" |
| VA-04 | Create issue | Edit transcript → Create issue | Create Issue modal prefilled (summary = first sentence, max 120 chars) |
| VA-05 | No key | Remove `SONIX_API_KEY`, restart, record | 503 "Voice agent is not configured: set SONIX_API_KEY" |
| VA-06 | Bad key | Invalid key | 502 "Sonix rejected the API key (bad credentials)" |
| VA-07 | Empty recording | POST empty file | 422 "The recording is empty" |
| VA-08 | Too large | POST > 25 MB | 413 "Recordings are limited to 25 MB" |
| VA-09 | Unknown media | GET `/api/voice/transcriptions/xyz` | 404 "Recording not found" |
| VA-10 | Key not exposed | Inspect network tab | Sonix key never appears in browser requests |

---

## 5. Non-functional tests

### 5.1 Security

| ID | Check | Expected |
|---|---|---|
| SEC-01 | All `/api/*` except login/register/health without token | 401 |
| SEC-02 | Tampered JWT signature | 401 |
| SEC-03 | Cross-project access by ID (issues, tests, runs, comments, sprints, shared steps) | 404, never data |
| SEC-04 | Passwords stored as bcrypt hash | No plain text in `users` table |
| SEC-05 | XSS: `<script>alert(1)</script>` in summary, comment, test title | Rendered as text |
| SEC-06 | SQL injection strings in search/fields | Treated as text; no error |
| SEC-07 | CORS | Only origins in `CORS_ORIGINS` allowed |
| SEC-08 | Voice transcript of another user's media id | **Known gap:** currently readable by any logged-in user |

### 5.2 UI / usability

| ID | Check | Expected |
|---|---|---|
| UI-01 | Layout at 1440 / 820 / 390 px | No horizontal scroll; sidebar collapses on tablet/mobile |
| UI-02 | Loading states | Spinner / "Loading…" while data loads |
| UI-03 | Toasts | Success and error toasts on every save |
| UI-04 | Form errors | Inline messages from validation and API errors |
| UI-05 | Keyboard | Tab through forms and dialogs; Esc closes dialogs |
| UI-06 | Unknown URL | `/xyz` redirects to `/dashboard` |
| UI-07 | Greeting | Dashboard greeting matches time of day |

### 5.3 Reliability / performance

| ID | Check | Expected |
|---|---|---|
| PERF-01 | Backend down | Clear error toast; no blank page |
| PERF-02 | Board with 200 issues | Drag stays smooth; page loads < 2 s locally |
| PERF-03 | Concurrent issue creation | Unique keys (ISS-19) |
| PERF-04 | Data persists | Restart backend and DB container; data still present |

---

## 6. End-to-end scenarios

| ID | Scenario | Flow |
|---|---|---|
| E2E-01 | Plan a sprint | Login → create epic + 3 stories → add criteria → create sprint → drag stories in → start sprint |
| E2E-02 | Deliver a story | Board: TODO → In Progress → Code Review → Testing → Done; comment at each step; check activity |
| E2E-03 | QA cycle | Create test case covering criteria → run (FAILED) → create bug → fix → re-run (PASSED) → traceability shows READY |
| E2E-04 | Close sprint | Complete sprint → unfinished issues back in backlog → next sprint can start |
| E2E-05 | Team access | Alex adds Nina to a new project → Nina sees it → outsider does not |
| E2E-06 | Voice to issue | Record note → transcript → create issue → appears in backlog |

---

## 7. Known issues to verify / retest

| # | Issue | Where |
|---|---|---|
| 1 | Suspense fallback shows corrupted "Loading�" | `frontend/src/routes/AppRoutes.tsx:5` |
| 2 | Any logged-in user can read any transcript by media id | `backend/app/api/voice.py` |
| 3 | Manual test status (`PATCH /test-cases/{id}/status`) is overwritten by next run | test cases service |
| 4 | Load failures show "Unable to save" message | `frontend/src/services/api.ts` `errorMessage()` |
| 5 | "+ Add test case" doesn't pass current project/story | `TestCaseList` |
| 6 | Deleting a comment isn't recorded in activity | comments service |
| 7 | Dashboard says "Good afternoon" late at night | Dashboard page |
| 8 | Sonix key currently rejected (401) — Voice Agent blocked | `backend/.env` |

---

## 8. Exit criteria

- All AUTO tests pass.
- 100 % of Critical/High functional cases (AUTH, PRJ isolation, ISS, SPR, EX, SEC) pass.
- No open Critical defects; known issues documented with owners.
- E2E-01 … E2E-05 pass in Chrome at desktop width.

## 9. Defect report template

```
Title:
Test case ID:
Environment (browser, viewport, commit):
Steps to reproduce:
Expected:
Actual:
Severity: Critical / High / Medium / Low
Screenshot / network response:
```
