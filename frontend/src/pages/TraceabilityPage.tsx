import { Fragment, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useData } from '../hooks/data';
import {
  label,
  type Sprint,
  type Traceability,
  type TraceStory,
} from '../types';
import { fullName, healthLabel, isOpen, percent, storyHealth } from '../lib/qa';
import { PageHeader, State, Badge } from '../components/ui/shared';
import { Kpi } from '../components/ui/charts';

function TestChip({ test }: { test: TraceStory['test_cases'][number] }) {
  return (
    <Link
      to={`/test-cases/${test.id}`}
      className={`chip chip-${test.status.toLowerCase()}`}
      title={`${test.title} · ${label(test.status)}${test.last_execution ? ` · ${test.last_execution.executed_on} by ${fullName(test.last_execution.tester)}` : ''}`}
    >
      {test.test_case_key}
    </Link>
  );
}

function Detail({ story }: { story: TraceStory }) {
  const unlinked = story.test_cases.filter((t) => !t.criterion_ids.length);
  return (
    <div className="trace-detail">
      <div>
        <h3>Acceptance criteria → tests → results</h3>
        {!story.criteria.length && (
          <p className="warn">
            No acceptance criteria. Add them on the story to measure coverage.
          </p>
        )}
        <ol className="trace-criteria">
          {story.criteria.map((c) => (
            <li key={c.id}>
              <span className={c.completed ? 'checked' : ''}>
                {c.description}
              </span>
              <span className="chips">
                {c.test_case_ids.length ? (
                  story.test_cases
                    .filter((t) => c.test_case_ids.includes(t.id))
                    .map((t) => <TestChip key={t.id} test={t} />)
                ) : (
                  <span className="badge badge-gap">No test</span>
                )}
              </span>
            </li>
          ))}
        </ol>
        {!!unlinked.length && (
          <p className="muted">
            Not linked to a criterion:{' '}
            {unlinked.map((t) => (
              <TestChip key={t.id} test={t} />
            ))}
          </p>
        )}
      </div>
      <div>
        <h3>Development</h3>
        {story.subtasks.length ? (
          <ul className="trace-list">
            {story.subtasks.map((s) => (
              <li key={s.id}>
                <Link to={`/issues/${s.id}`}>{s.issue_key}</Link> {s.summary}{' '}
                <Badge value={s.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No development subtasks.</p>
        )}
        <h3 className="spaced">Defects</h3>
        {story.bugs.length ? (
          <ul className="trace-list">
            {story.bugs.map((b) => {
              const test = story.test_cases.find(
                (t) => t.id === b.related_test_case_id,
              );
              return (
                <li key={b.id}>
                  <Link to={`/issues/${b.id}`}>{b.issue_key}</Link> {b.summary}{' '}
                  <Badge value={b.status} />
                  {test && (
                    <span className="muted"> · from {test.test_case_key}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">No defects linked.</p>
        )}
      </div>
    </div>
  );
}

export default function TraceabilityPage() {
  const pid = Number(useParams().projectId);
  const [params] = useSearchParams();
  const query = useData<Traceability>(`/projects/${pid}/traceability`);
  const sprints = useData<Sprint[]>(`/projects/${pid}/sprints`);
  const [epic, setEpic] = useState(0);
  const [sprint, setSprint] = useState(0);
  const [gapsOnly, setGapsOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set([Number(params.get('story'))].filter(Boolean)),
  );
  const data = query.data;
  if (!data) return <State loading={query.isLoading} error={query.error} />;
  const stories = data.stories.filter(
    (s) =>
      (!epic || s.epic_id === epic) &&
      (!sprint || s.sprint_id === sprint) &&
      (!gapsOnly || storyHealth(s) !== 'READY'),
  );
  const criteria = data.stories.flatMap((s) => s.criteria);
  const tests = data.stories.flatMap((s) => s.test_cases);
  const bugs = data.stories.flatMap((s) => s.bugs);
  const toggle = (id: number) =>
    setExpanded((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    <>
      <PageHeader
        title="Traceability Matrix"
        description="Follow each requirement through development, testing and defects."
      />
      <div className="kpis">
        <Kpi
          name="Stories with tests"
          value={`${percent(data.stories.filter((s) => s.test_cases.length).length, data.stories.length)}%`}
          hint={`${data.stories.length} stories`}
        />
        <Kpi
          name="Criteria covered"
          value={`${percent(criteria.filter((c) => c.test_case_ids.length).length, criteria.length)}%`}
          hint={`${criteria.filter((c) => !c.test_case_ids.length).length} without a test`}
        />
        <Kpi
          name="Tests passing"
          value={`${percent(tests.filter((t) => t.status === 'PASSED').length, tests.length)}%`}
          hint={`${tests.length} tests`}
        />
        <Kpi
          name="Open defects"
          value={bugs.filter((b) => isOpen(b.status)).length}
          tone={bugs.some((b) => isOpen(b.status)) ? 'warn' : 'good'}
        />
      </div>
      <section className="card">
        <div className="filters">
          <select
            aria-label="Filter by epic"
            value={epic}
            onChange={(e) => setEpic(Number(e.target.value))}
          >
            <option value={0}>All epics</option>
            {data.epics.map((e) => (
              <option key={e.id} value={e.id}>
                {e.issue_key} — {e.summary}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by sprint"
            value={sprint}
            onChange={(e) => setSprint(Number(e.target.value))}
          >
            <option value={0}>All sprints</option>
            {sprints.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <label className="check-row">
            <input
              type="checkbox"
              checked={gapsOnly}
              onChange={(e) => setGapsOnly(e.target.checked)}
            />
            Only stories that need attention
          </label>
        </div>
        {!stories.length ? (
          <div className="empty">
            {data.stories.length
              ? 'Every story matching these filters is ready.'
              : 'No user stories yet.'}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="trace-table">
              <thead>
                <tr>
                  <th>Story</th>
                  <th>Requirement</th>
                  <th>Development</th>
                  <th>Criteria covered</th>
                  <th>Tests · latest result</th>
                  <th>Defects</th>
                  <th>Health</th>
                </tr>
              </thead>
              <tbody>
                {stories.map((s) => {
                  const health = storyHealth(s);
                  const covered = s.criteria.filter(
                    (c) => c.test_case_ids.length,
                  ).length;
                  const openBugs = s.bugs.filter((b) => isOpen(b.status));
                  const done = s.subtasks.filter(
                    (t) => t.status === 'DONE',
                  ).length;
                  const isOpenRow = expanded.has(s.id);
                  return (
                    <Fragment key={s.id}>
                      <tr>
                        <td className="key">
                          <button
                            className="expand"
                            aria-expanded={isOpenRow}
                            aria-label={`${isOpenRow ? 'Collapse' : 'Expand'} ${s.issue_key}`}
                            onClick={() => toggle(s.id)}
                          >
                            {isOpenRow ? '▾' : '▸'}
                          </button>
                          <Link to={`/issues/${s.id}`}>{s.issue_key}</Link>
                        </td>
                        <td>
                          <Link to={`/issues/${s.id}`}>{s.summary}</Link>
                          <div className="muted">
                            {label(s.priority)} · {fullName(s.assignee)}
                          </div>
                        </td>
                        <td>
                          <Badge value={s.status} />
                          <div className="muted">
                            {s.subtasks.length
                              ? `${done}/${s.subtasks.length} subtasks done`
                              : 'No subtasks'}
                          </div>
                        </td>
                        <td
                          className={
                            covered < s.criteria.length || !s.criteria.length
                              ? 'warn'
                              : 'muted'
                          }
                        >
                          {s.criteria.length
                            ? `${covered}/${s.criteria.length}`
                            : 'None defined'}
                        </td>
                        <td>
                          <span className="chips">
                            {s.test_cases.length ? (
                              s.test_cases.map((t) => (
                                <TestChip key={t.id} test={t} />
                              ))
                            ) : (
                              <span className="warn">No tests</span>
                            )}
                          </span>
                        </td>
                        <td>
                          {s.bugs.length ? (
                            <span
                              className={openBugs.length ? 'error' : 'muted'}
                            >
                              {openBugs.length} open / {s.bugs.length}
                            </span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge badge-${health.toLowerCase()}`}
                          >
                            {healthLabel[health]}
                          </span>
                        </td>
                      </tr>
                      {isOpenRow && (
                        <tr className="trace-expanded">
                          <td colSpan={7}>
                            <Detail story={s} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
