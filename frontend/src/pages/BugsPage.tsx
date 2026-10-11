import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useData, useSave } from '../hooks/data';
import {
  label,
  priorities,
  statuses,
  type Execution,
  type Issue,
  type Project,
  type TestCase,
} from '../types';
import { fullName, isOpen } from '../lib/qa';
import { PageHeader, State } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import { BarChart, Kpi } from '../components/ui/charts';
import { useCreateIssue } from '../components/layout/AppShell';

function StatusSelect({ bug }: { bug: Issue }) {
  const save = useSave(`/issues/${bug.id}/status`, 'patch', 'Bug updated');
  return (
    <select
      className="card-status"
      aria-label={`Status for ${bug.issue_key}`}
      value={bug.status}
      disabled={save.isPending}
      onChange={(e) => save.mutate({ status: e.target.value })}
    >
      {statuses.map((s) => (
        <option key={s} value={s}>
          {label(s)}
        </option>
      ))}
    </select>
  );
}

export default function BugsPage() {
  const pid = Number(useParams().projectId);
  const project = useData<Project>(`/projects/${pid}`);
  const issues = useData<Issue[]>(`/issues?project_id=${pid}`);
  const tests = useData<TestCase[]>(`/test-cases?project_id=${pid}`);
  const runs = useData<Execution[]>(`/test-executions?project_id=${pid}`);
  const create = useCreateIssue();
  const [state, setState] = useState('OPEN');
  const [priority, setPriority] = useState('');
  const [assignee, setAssignee] = useState('');
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const all = issues.data ?? [];
  const bugs = all.filter((i) => i.issue_type === 'BUG');
  const open = bugs.filter((b) => isOpen(b.status));
  const shown = bugs
    .filter(
      (b) =>
        (state === 'ALL' ||
          (state === 'OPEN' ? isOpen(b.status) : b.status === state)) &&
        (!priority || b.priority === priority) &&
        (!assignee || String(b.assignee_id ?? 'none') === assignee) &&
        (!source || (source === 'test') === !!b.related_test_case_id) &&
        (!search ||
          `${b.issue_key} ${b.summary}`
            .toLowerCase()
            .includes(search.toLowerCase())),
    )
    .sort(
      (a, b) =>
        priorities.indexOf(b.priority) - priorities.indexOf(a.priority) ||
        b.updated_at.localeCompare(a.updated_at),
    );
  const fromTests = bugs.filter((b) => b.related_test_case_id).length;
  return (
    <>
      <PageHeader
        title="Bug Tracking"
        description="Defects found in testing, linked to the story and test that exposed them."
      >
        <Button
          onClick={() =>
            create({ project_id: pid, issue_type: 'BUG', priority: 'HIGH' })
          }
        >
          + Report bug
        </Button>
      </PageHeader>
      <State loading={issues.isLoading} error={issues.error} />
      <div className="kpis">
        <Kpi
          name="Open bugs"
          value={open.length}
          tone={open.length ? 'warn' : 'good'}
        />
        <Kpi
          name="Critical open"
          value={open.filter((b) => b.priority === 'CRITICAL').length}
          tone={open.some((b) => b.priority === 'CRITICAL') ? 'bad' : 'good'}
        />
        <Kpi
          name="Fixed"
          value={bugs.length - open.length}
          hint={`of ${bugs.length} reported`}
        />
        <Kpi
          name="Found by tests"
          value={fromTests}
          hint={`${bugs.length - fromTests} reported directly`}
        />
      </div>
      <div className="dashboard-detail">
        <section className="card">
          <div className="filters">
            <input
              type="search"
              aria-label="Search bugs"
              placeholder="Search bugs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Filter by status"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              <option value="OPEN">Open</option>
              <option value="ALL">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="">All priorities</option>
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {label(p)}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by assignee"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Anyone</option>
              <option value="none">Unassigned</option>
              {project.data?.members.map((u) => (
                <option key={u.id} value={u.id}>
                  {fullName(u)}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="">Any source</option>
              <option value="test">Found by a test</option>
              <option value="direct">Reported directly</option>
            </select>
          </div>
          {!issues.isLoading && !shown.length ? (
            <div className="empty">
              {bugs.length
                ? 'No bugs match these filters.'
                : 'No bugs reported. Failed test runs can log one in a click.'}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Summary</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assignee</th>
                    <th>Story</th>
                    <th>Found by</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((b) => {
                    const story = all.find((i) => i.id === b.related_issue_id);
                    const test = tests.data?.find(
                      (t) => t.id === b.related_test_case_id,
                    );
                    const run = runs.data?.find(
                      (r) => r.id === b.related_execution_id,
                    );
                    return (
                      <tr key={b.id}>
                        <td className="key">
                          <Link to={`/issues/${b.id}`}>{b.issue_key}</Link>
                        </td>
                        <td>
                          <Link to={`/issues/${b.id}`}>{b.summary}</Link>
                        </td>
                        <td
                          className={
                            b.priority === 'CRITICAL' ? 'error' : 'muted'
                          }
                        >
                          {label(b.priority)}
                        </td>
                        <td>
                          <StatusSelect bug={b} />
                        </td>
                        <td className="muted">{fullName(b.assignee)}</td>
                        <td className="key">
                          {story ? (
                            <Link
                              to={`/issues/${story.id}`}
                              title={story.summary}
                            >
                              {story.issue_key}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="muted">
                          {test ? (
                            <Link
                              to={`/test-cases/${test.id}${run ? `#run-${run.id}` : ''}`}
                              title={test.title}
                            >
                              {test.test_case_key}
                              {run && ` · run ${run.executed_on}`}
                            </Link>
                          ) : (
                            'Reported'
                          )}
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
            title="Open bugs by priority"
            rows={[...priorities].reverse().map((p) => ({
              key: p,
              count: open.filter((b) => b.priority === p).length,
            }))}
          />
          <BarChart
            title="Bugs by status"
            rows={statuses.map((s) => ({
              key: s,
              count: bugs.filter((b) => b.status === s).length,
            }))}
          />
        </div>
      </div>
    </>
  );
}
