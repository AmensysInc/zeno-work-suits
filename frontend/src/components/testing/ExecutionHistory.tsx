import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useData, useIssues, useSave } from '../../hooks/data';
import type { Execution, Sprint, TestCase } from '../../types';
import { bugFromRun, fullName } from '../../lib/qa';
import { Badge, State } from '../ui/shared';
import { Button } from '../ui/button';
import { useCreateIssue } from '../layout/AppShell';
import RunTestModal from './RunTestModal';

function DeleteRun({ id }: { id: number }) {
  const del = useSave(`/test-executions/${id}`, 'delete', 'Test run deleted');
  return (
    <Button
      variant="ghost"
      disabled={del.isPending}
      onClick={() => {
        if (window.confirm('Delete this test run? Its step results are lost.'))
          del.mutate({});
      }}
    >
      Delete
    </Button>
  );
}

export default function ExecutionHistory({
  testCase: tc,
}: {
  testCase: TestCase;
}) {
  const runs = useData<Execution[]>(`/test-executions?test_case_id=${tc.id}`);
  const sprints = useData<Sprint[]>(`/projects/${tc.project_id}/sprints`);
  const issues = useIssues(tc.project_id);
  const create = useCreateIssue();
  const [open, setOpen] = useState<Execution | null>(null);
  const { hash } = useLocation();
  const loaded = !!runs.data;
  useEffect(() => {
    if (loaded && hash.startsWith('#run'))
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [loaded, hash]);
  const bugs =
    issues.data?.filter(
      (i) => i.issue_type === 'BUG' && i.related_test_case_id === tc.id,
    ) ?? [];
  return (
    <section className="card" id="runs">
      <div className="section-head">
        <h2>Execution history</h2>
        <span className="muted">
          {runs.data?.length ?? 0} run{runs.data?.length === 1 ? '' : 's'}
        </span>
      </div>
      <State
        loading={runs.isLoading}
        error={runs.error}
        empty={!runs.isLoading && !runs.data?.length}
      />
      {!!runs.data?.length && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Actual result</th>
                <th>Result</th>
                <th>Tester</th>
                <th>Sprint</th>
                <th>Defects</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {runs.data.map((run) => {
                const linked = bugs.filter(
                  (b) => b.related_execution_id === run.id,
                );
                return (
                  <tr
                    key={run.id}
                    id={`run-${run.id}`}
                    className={hash === `#run-${run.id}` ? 'highlight' : ''}
                  >
                    <td>{run.executed_on}</td>
                    <td>
                      <button className="link" onClick={() => setOpen(run)}>
                        {run.actual_result || 'View step results'}
                      </button>
                      {run.environment && (
                        <span className="muted"> · {run.environment}</span>
                      )}
                    </td>
                    <td>
                      <Badge value={run.status} />
                    </td>
                    <td className="muted">{fullName(run.tester)}</td>
                    <td className="muted">
                      {sprints.data?.find((s) => s.id === run.sprint_id)
                        ?.name ?? '—'}
                    </td>
                    <td>
                      {linked.map((b) => (
                        <Link
                          key={b.id}
                          className="chip"
                          to={`/issues/${b.id}`}
                        >
                          {b.issue_key}
                        </Link>
                      ))}
                      {run.status === 'FAILED' && !linked.length && (
                        <Button
                          variant="destructive"
                          onClick={() => create(bugFromRun(tc, run))}
                        >
                          Log bug
                        </Button>
                      )}
                    </td>
                    <td>
                      <DeleteRun id={run.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {open && (
        <RunTestModal
          testCase={tc}
          execution={open}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
