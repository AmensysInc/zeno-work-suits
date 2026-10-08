import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData, useSave } from '../hooks/data';
import type { TestCase } from '../types';
import { label } from '../types';
import { PageHeader, State, Badge, Field } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import TestCaseForm from '../components/testing/TestCaseForm';
import { useCreateIssue } from '../components/layout/AppShell';
export default function TestCaseDetailsPage() {
  const { testCaseId } = useParams();
  const query = useData<TestCase>(`/test-cases/${testCaseId}`);
  const save = useSave(
    `/test-cases/${testCaseId}/status`,
    'patch',
    'Test result saved',
  );
  const del = useSave(
    `/test-cases/${testCaseId}`,
    'delete',
    'Test case deleted',
  );
  const create = useCreateIssue();
  const nav = useNavigate();
  const [editing, setEditing] = useState(false);
  const tc = query.data;
  if (!tc) return <State loading={query.isLoading} error={query.error} />;
  return (
    <>
      <PageHeader
        title={editing ? 'Edit test case' : tc.title}
        description={`${tc.test_case_key} · ${label(tc.test_type)}`}
      >
        <Button variant="outline" onClick={() => setEditing(!editing)}>
          {editing ? 'Close editor' : 'Edit'}
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            if (!window.confirm('Delete this test case and its steps?')) return;
            try {
              await del.mutateAsync({});
              nav('/test-cases');
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
          <section className="card">
            <div className="section-head">
              <Link to={`/issues/${tc.issue_id}`}>
                View linked user story →
              </Link>
              <Badge value={tc.priority} />
            </div>
            <Field label="Test result">
              <select
                value={tc.status}
                disabled={save.isPending}
                onChange={(e) => save.mutate({ status: e.target.value })}
              >
                {['NOT_RUN', 'PASSED', 'FAILED', 'BLOCKED', 'SKIPPED'].map(
                  (s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ),
                )}
              </select>
            </Field>
            {tc.status === 'FAILED' && (
              <Button
                variant="destructive"
                onClick={() =>
                  create({
                    project_id: tc.project_id,
                    issue_type: 'BUG',
                    summary: `Failed: ${tc.title}`,
                    description: `Failed test: ${tc.test_case_key} — ${tc.title}\n\nPreconditions: ${tc.preconditions}\n\nSteps:\n${tc.steps.map((s) => `${s.step_number}. ${s.action}`).join('\n')}\n\nExpected: ${tc.expected_result}`,
                    related_issue_id: tc.issue_id,
                    related_test_case_id: tc.id,
                  })
                }
              >
                Create bug
              </Button>
            )}
            <h2 className="spaced">Preconditions</h2>
            <p>{tc.preconditions || 'None specified'}</p>
          </section>
          <section className="card">
            <h2>Test steps</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Action</th>
                    <th>Expected result</th>
                  </tr>
                </thead>
                <tbody>
                  {tc.steps.map((s) => (
                    <tr key={s.id}>
                      <td>{s.step_number}</td>
                      <td>{s.action}</td>
                      <td>{s.expected_result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h2 className="spaced">Expected result</h2>
            <p>{tc.expected_result || 'None specified'}</p>
            <h2 className="spaced">Test data</h2>
            <p className="prewrap">{tc.test_data || 'None specified'}</p>
          </section>
        </>
      )}
    </>
  );
}
