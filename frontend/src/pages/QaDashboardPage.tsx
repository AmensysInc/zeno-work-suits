import { Link, useParams } from 'react-router-dom';
import { useData } from '../hooks/data';
import {
  priorities,
  testStatuses,
  type Execution,
  type Issue,
  type Project,
  type Traceability,
} from '../types';
import { fullName, healthLabel, isOpen, percent, storyHealth } from '../lib/qa';
import { PageHeader, State, Badge } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import { BarChart, Kpi, Progress } from '../components/ui/charts';

export default function QaDashboardPage() {
  const pid = Number(useParams().projectId);
  const project = useData<Project>(`/projects/${pid}`);
  const trace = useData<Traceability>(`/projects/${pid}/traceability`);
  const runs = useData<Execution[]>(`/test-executions?project_id=${pid}`);
  const issues = useData<Issue[]>(`/issues?project_id=${pid}`);
  const loading = trace.isLoading || runs.isLoading || issues.isLoading;
  const error = trace.error || runs.error || issues.error;
  if (!trace.data || !runs.data || !issues.data)
    return <State loading={loading} error={error} />;
  const stories = trace.data.stories;
  const tests = stories.flatMap((s) => s.test_cases);
  const criteria = stories.flatMap((s) => s.criteria);
  const bugs = issues.data.filter((i) => i.issue_type === 'BUG');
  const openBugs = bugs.filter((b) => isOpen(b.status));
  const count = (status: string) =>
    tests.filter((t) => t.status === status).length;
  const executed = tests.length - count('NOT_RUN');
  const atRisk = stories.filter((s) => storyHealth(s) !== 'READY');
  const since = new Date(Date.now() - 14 * 864e5).toLocaleDateString('en-CA');
  const recent = runs.data.filter((r) => r.executed_on >= since);
  const testers = [
    ...new Map(recent.map((r) => [r.tester_id, r.tester])).values(),
  ];
  return (
    <>
      <PageHeader
        title="QA Dashboard"
        description={`Quality at a glance for ${project.data?.name ?? 'this project'}.`}
      >
        <Button asChild variant="outline">
          <Link to={`/projects/${pid}/traceability`}>Traceability</Link>
        </Button>
        <Button asChild>
          <Link to={`/projects/${pid}/test-runs`}>Run tests</Link>
        </Button>
      </PageHeader>
      <div className="kpis kpis-6">
        <Kpi
          name="Requirement coverage"
          value={`${percent(stories.filter((s) => s.test_cases.length).length, stories.length)}%`}
          hint={`${stories.filter((s) => !s.test_cases.length).length} stories without tests`}
        />
        <Kpi
          name="Criteria coverage"
          value={`${percent(criteria.filter((c) => c.test_case_ids.length).length, criteria.length)}%`}
          hint={`${criteria.length} acceptance criteria`}
        />
        <Kpi
          name="Execution progress"
          value={`${percent(executed, tests.length)}%`}
          hint={`${executed} of ${tests.length} tests run`}
        />
        <Kpi
          name="Pass rate"
          value={`${percent(count('PASSED'), executed)}%`}
          hint="of executed tests"
          tone={
            !executed
              ? undefined
              : count('PASSED') === executed
                ? 'good'
                : 'warn'
          }
        />
        <Kpi
          name="Open defects"
          value={openBugs.length}
          hint={`${openBugs.filter((b) => b.priority === 'CRITICAL').length} critical`}
          tone={
            openBugs.some((b) => b.priority === 'CRITICAL')
              ? 'bad'
              : openBugs.length
                ? 'warn'
                : 'good'
          }
        />
        <Kpi
          name="Stories ready"
          value={`${stories.length - atRisk.length}/${stories.length}`}
          hint="covered, passing, no open bugs"
        />
      </div>
      <section className="card">
        <h2>Latest test results</h2>
        <Progress
          rows={testStatuses.map((s) => ({ key: s, count: count(s) }))}
        />
      </section>
      <div className="dashboard-detail">
        <section className="card">
          <div className="section-head">
            <h2>Stories needing attention</h2>
            <Link to={`/projects/${pid}/traceability`}>View all →</Link>
          </div>
          {!atRisk.length ? (
            <div className="empty">
              Every story is covered, passing and free of open bugs.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Story</th>
                    <th>Summary</th>
                    <th>Criteria</th>
                    <th>Failing</th>
                    <th>Open bugs</th>
                    <th>Health</th>
                  </tr>
                </thead>
                <tbody>
                  {atRisk.slice(0, 8).map((s) => {
                    const health = storyHealth(s);
                    return (
                      <tr key={s.id}>
                        <td className="key">
                          <Link
                            to={`/projects/${pid}/traceability?story=${s.id}`}
                          >
                            {s.issue_key}
                          </Link>
                        </td>
                        <td>
                          <Link to={`/issues/${s.id}`}>{s.summary}</Link>
                        </td>
                        <td className="muted">
                          {
                            s.criteria.filter((c) => c.test_case_ids.length)
                              .length
                          }
                          /{s.criteria.length}
                        </td>
                        <td className="muted">
                          {
                            s.test_cases.filter((t) =>
                              ['FAILED', 'BLOCKED'].includes(t.status),
                            ).length
                          }
                          /{s.test_cases.length}
                        </td>
                        <td className="muted">
                          {s.bugs.filter((b) => isOpen(b.status)).length}
                        </td>
                        <td>
                          <span
                            className={`badge badge-${health.toLowerCase()}`}
                          >
                            {healthLabel[health]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <div className="chart-grid">
          <BarChart
            title="Open defects by priority"
            rows={[...priorities].reverse().map((p) => ({
              key: p,
              count: openBugs.filter((b) => b.priority === p).length,
            }))}
          />
          <BarChart
            title="Runs per tester · 14 days"
            rows={
              testers.length
                ? testers.map((u) => ({
                    key: `tester-${u.id}`,
                    name: u.first_name,
                    count: recent.filter((r) => r.tester_id === u.id).length,
                  }))
                : [{ key: 'none', name: 'No runs', count: 0 }]
            }
          />
        </div>
      </div>
      <section className="card">
        <h2>Recent test runs</h2>
        {!runs.data.length ? (
          <div className="empty">
            No tests have been run yet. Open the execution board to start.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Test case</th>
                  <th>Result</th>
                  <th>Tester</th>
                  <th>Actual result</th>
                </tr>
              </thead>
              <tbody>
                {runs.data.slice(0, 8).map((r) => (
                  <tr key={r.id}>
                    <td className="muted">{r.executed_on}</td>
                    <td>
                      <Link to={`/test-cases/${r.test_case_id}#run-${r.id}`}>
                        {r.test_case_key} · {r.test_case_title}
                      </Link>
                    </td>
                    <td>
                      <Badge value={r.status} />
                    </td>
                    <td className="muted">{fullName(r.tester)}</td>
                    <td className="muted wrap">{r.actual_result || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
