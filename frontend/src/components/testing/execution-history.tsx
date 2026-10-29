'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bug, Trash2 } from 'lucide-react';
import { useCanLead, useData, useIssues, useMe, useSave } from '@/hooks/data';
import type { Execution, Sprint, TestCase } from '@/types';
import { bugFromRun, fullName } from '@/lib/qa';
import { Avatar, Card, CardHeader, State, Tag } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { ResultBadge } from '@/components/ui/glyphs';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { confirm } from '@/components/ui/confirm';
import { useCreateIssue } from '@/components/layout/context';
import RunTestDialog from './run-test-dialog';

function DeleteRun({ id, allowed }: { id: number; allowed: boolean }) {
  const del = useSave(`/test-executions/${id}`, 'delete', 'Test run deleted');
  if (!allowed) return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      icon={<Trash2 />}
      aria-label="Delete test run"
      disabled={del.isPending}
      onClick={async () => {
        if (await confirm('Delete this test run? Its step results are lost.', { okText: 'Delete' })) del.mutate({});
      }}
    />
  );
}

export default function ExecutionHistory({ testCase: tc }: { testCase: TestCase }) {
  const runs = useData<Execution[]>(`/test-executions?test_case_id=${tc.id}`);
  const me = useMe();
  const canLead = useCanLead(tc.project_id);
  const sprints = useData<Sprint[]>(`/projects/${tc.project_id}/sprints`);
  const issues = useIssues(tc.project_id);
  const create = useCreateIssue();
  const [open, setOpen] = useState<Execution | null>(null);
  const [hash, setHash] = useState('');
  const loaded = !!runs.data;
  useEffect(() => {
    const h = window.location.hash;
    setHash(h);
    if (loaded && h.startsWith('#run')) document.getElementById(h.slice(1))?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [loaded]);
  const bugs = issues.data?.filter((i) => i.issue_type === 'BUG' && i.related_test_case_id === tc.id) ?? [];
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Execution history" subtitle={`${runs.data?.length ?? 0} run${runs.data?.length === 1 ? '' : 's'}`} className="pb-3" />
      <State loading={runs.isLoading} error={runs.error} empty={!runs.isLoading && !runs.data?.length} emptyText="This test has not been run yet." />
      {!!runs.data?.length && (
        <Table>
          <thead>
            <tr>
              <Th className="w-28">Date</Th>
              <Th>Actual result</Th>
              <Th className="w-28">Result</Th>
              <Th className="w-40">Tester</Th>
              <Th className="w-28">Sprint</Th>
              <Th className="w-32">Defects</Th>
              <Th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {runs.data.map((run) => {
              const linked = bugs.filter((b) => b.related_execution_id === run.id);
              return (
                <Tr key={run.id} id={`run-${run.id}`} selected={hash === `#run-${run.id}`}>
                  <Td className="whitespace-nowrap text-ink-2">{run.executed_on}</Td>
                  <Td>
                    <button className="text-left font-medium text-accent-ink hover:underline" onClick={() => setOpen(run)}>
                      {run.actual_result || 'View step results'}
                    </button>
                    {run.environment && <span className="text-xs text-ink-3"> · {run.environment}</span>}
                  </Td>
                  <Td>
                    <ResultBadge status={run.status} />
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      <Avatar user={run.tester} size={20} />
                      {fullName(run.tester)}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-[12.5px] text-ink-2">{sprints.data?.find((s) => s.id === run.sprint_id)?.name ?? '—'}</Td>
                  <Td>
                    <span className="flex flex-wrap items-center gap-1">
                      {linked.map((b) => (
                        <Link key={b.id} href={`/issues/${b.id}`}>
                          <Tag color="#e5484d">{b.issue_key}</Tag>
                        </Link>
                      ))}
                      {run.status === 'FAILED' && !linked.length && (
                        <Button size="sm" variant="danger" icon={<Bug />} onClick={() => create(bugFromRun(tc, run))}>
                          Log bug
                        </Button>
                      )}
                    </span>
                  </Td>
                  <Td>
                    <DeleteRun id={run.id} allowed={canLead || run.tester_id === me.data?.id} />
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {open && <RunTestDialog testCase={tc} execution={open} onClose={() => setOpen(null)} />}
    </Card>
  );
}
