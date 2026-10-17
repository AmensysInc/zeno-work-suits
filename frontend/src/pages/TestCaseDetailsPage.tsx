import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData, useSave } from '../hooks/data';
import type { Criterion, Issue, TestCase } from '../types';
import { label } from '../types';
import { PageHeader, State, Badge } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import TestCaseForm from '../components/testing/TestCaseForm';
import RunTestModal from '../components/testing/RunTestModal';
import ExecutionHistory from '../components/testing/ExecutionHistory';
import { usePageProject } from '../components/layout/AppShell';
export default function TestCaseDetailsPage() {
  const { testCaseId } = useParams();
  const query = useData<TestCase>(`/test-cases/${testCaseId}`);
  const tc = query.data;
  const story = useData<Issue>(`/issues/${tc?.issue_id}`, !!tc);
  const criteria = useData<Criterion[]>(
    `/issues/${tc?.issue_id}/acceptance-criteria`,
    !!tc,
  );
  const del = useSave(
    `/test-cases/${testCaseId}`,
    'delete',
    'Test case deleted',
  );
  const nav = useNavigate();
  const [editing, setEditing] = useState(false);
  const [running, setRunning] = useState(false);
  usePageProject(tc?.project_id);
  if (!tc) return <State loading={query.isLoading} error={query.error} />;
  const covered = criteria.data?.filter((c) => tc.criterion_ids.includes(c.id));
  return (
    <>
      <PageHeader
        title={editing ? 'Edit test case' : tc.title}
        description={`${tc.test_case_key} · ${label(tc.test_type)} · ${tc.steps.length} steps`}
      >
        {!editing && (
          <Button onClick={() => setRunning(true)}>▶ Run test</Button>
        )}
        <Button variant="outline" onClick={() => setEditing(!editing)}>
          {editing ? 'Close editor' : 'Edit'}
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            if (
              !window.confirm(
                'Delete this test case, its steps and its run history?',
              )
            )
              return;
            try {
              await del.mutateAsync({});
              nav(`/projects/${tc.project_id}/test-cases`);
            } catch {
              /*toast*/
            }
          }}
        >
          Delete
        </Button>
      </PageHeader>
      {editing ? (
        <TestCaseForm
          key={tc.updated_at}
          initial={tc}
          onSaved={() => setEditing(false)}
        />
      ) : (
        <>
          <div className="detail-grid">
            <section className="card">
              <h2>Test steps</h2>
              <div className="table-wrap">
                <table className="steps-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Action</th>
                      <th>Test data</th>
                      <th>Expected result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tc.steps.map((s) => (
                      <tr key={s.id}>
                        <td>{s.step_number}</td>
                        <td>
                          {s.action}
                          {s.shared_step_id && (
                            <span className="chip" title="Reusable step">
                              Reusable
                            </span>
                          )}
                        </td>
                        <td className="prewrap muted">{s.test_data || '—'}</td>
                        <td className="prewrap">{s.expected_result}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h2 className="spaced">Preconditions</h2>
              <p className="prewrap">{tc.preconditions || 'None specified'}</p>
              <h2 className="spaced">Expected result</h2>
              <p className="prewrap">
                {tc.expected_result || 'None specified'}
              </p>
              <h2 className="spaced">Test data</h2>
              <p className="prewrap">{tc.test_data || 'None specified'}</p>
            </section>
            <aside className="card details-panel">
              <h2>Details</h2>
              <dl>
                <dt>Latest result</dt>
                <dd>
                  <Badge value={tc.status} />
                </dd>
                <dt>Last run</dt>
                <dd>{tc.last_executed_on ?? 'Never'}</dd>
                <dt>Runs</dt>
                <dd>{tc.execution_count}</dd>
                <dt>Priority</dt>
                <dd>
                  <Badge value={tc.priority} />
                </dd>
                <dt>User story</dt>
                <dd>
                  <Link to={`/issues/${tc.issue_id}`}>
                    {story.data
                      ? `${story.data.issue_key} ${story.data.summary}`
                      : 'View story'}
                  </Link>
                </dd>
                {tc.ai_source?.source_commit && (
                  <>
                    <dt>Generated from</dt>
                    <dd>
                      {tc.ai_source.repository}
                      {tc.ai_source.module_path
                        ? ` / ${tc.ai_source.module_path}`
                        : ''}{' '}
                      @{tc.ai_source.source_commit.slice(0, 7)}
                    </dd>
                  </>
                )}
              </dl>
              <h3 className="spaced">Covers acceptance criteria</h3>
              {covered?.length ? (
                <ul className="covered">
                  {covered.map((c) => (
                    <li key={c.id}>{c.description}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">
                  Not linked to any criterion. Edit the test to add coverage.
                </p>
              )}
            </aside>
          </div>
          <ExecutionHistory testCase={tc} />
        </>
      )}
      {running && (
        <RunTestModal testCase={tc} onClose={() => setRunning(false)} />
      )}
    </>
  );
}
