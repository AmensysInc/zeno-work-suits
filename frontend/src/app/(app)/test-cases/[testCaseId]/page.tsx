'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Check, Pencil, Play, Trash2, X } from 'lucide-react';
import { useCanLead, useData, useSave } from '@/hooks/data';
import { label, type Criterion, type Issue, type TestCase } from '@/types';
import { PageBar, PageBody } from '@/components/layout/page';
import { usePageProject } from '@/components/layout/context';
import { Badge, Card, CardHeader, State } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { IssueKey, ResultBadge } from '@/components/ui/glyphs';
import { confirm } from '@/components/ui/confirm';
import TestCaseForm from '@/components/testing/test-case-form';
import RunTestDialog from '@/components/testing/run-test-dialog';
import ExecutionHistory from '@/components/testing/execution-history';

function Prop({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center gap-3 text-[13px]">
      <span className="w-28 shrink-0 text-ink-3">{name}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="caps">{title}</span>
      <p className="whitespace-pre-wrap text-[13px] text-ink-2">{children}</p>
    </div>
  );
}

export default function TestCaseDetailsPage() {
  const { testCaseId } = useParams<{ testCaseId: string }>();
  const query = useData<TestCase>(`/test-cases/${testCaseId}`);
  const tc = query.data;
  const story = useData<Issue>(`/issues/${tc?.issue_id}`, !!tc);
  const criteria = useData<Criterion[]>(`/issues/${tc?.issue_id}/acceptance-criteria`, !!tc);
  const del = useSave(`/test-cases/${testCaseId}`, 'delete', 'Test case deleted');
  const router = useRouter();
  const canLead = useCanLead(tc?.project_id);
  const [editing, setEditing] = useState(false);
  const [running, setRunning] = useState(false);
  usePageProject(tc?.project_id);
  const covered = criteria.data?.filter((c) => tc?.criterion_ids.includes(c.id));
  return (
    <>
      <PageBar
        crumbs={[{ label: 'Test repository', href: tc ? `/projects/${tc.project_id}/test-cases` : '/test-cases' }, tc?.test_case_key ?? 'Test case']}
        projectId={tc?.project_id}
        actions={
          tc && (
            <>
              {canLead && (
                <Button
                  variant="ghost"
                  icon={<Trash2 />}
                  aria-label="Delete test case"
                  onClick={async () => {
                    if (!(await confirm('Delete this test case, its steps and its run history?', { okText: 'Delete' }))) return;
                    try {
                      await del.mutateAsync({});
                      router.push(`/projects/${tc.project_id}/test-cases`);
                    } catch {
                      /* toast */
                    }
                  }}
                >
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              )}
              <Button icon={editing ? <X /> : <Pencil />} onClick={() => setEditing(!editing)}>
                {editing ? 'Close editor' : 'Edit'}
              </Button>
              {!editing && (
                <Button variant="primary" icon={<Play />} onClick={() => setRunning(true)}>
                  Run test
                </Button>
              )}
            </>
          )
        }
      />
      <PageBody>
        {!tc ? (
          <State loading={query.isLoading} error={query.error} />
        ) : editing ? (
          <div className="mx-auto max-w-[960px]">
            <TestCaseForm key={tc.updated_at} initial={tc} onSaved={() => setEditing(false)} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-[22px] font-semibold tracking-tight">{tc.title}</h1>
              <span className="text-[12.5px] text-ink-3">
                <IssueKey>{tc.test_case_key}</IssueKey> · {label(tc.test_type)} · {tc.steps.length} steps
              </span>
            </div>
            <div className="grid items-start gap-4 xl:grid-cols-[1fr_320px]">
              <Card className="overflow-hidden">
                <CardHeader title="Test steps" className="pb-3" />
                <div className="border-t border-line">
                  {tc.steps.map((s) => (
                    <div key={s.step_number} className="grid gap-2 border-b border-line px-4 py-3 text-[13px] md:grid-cols-[28px_1.3fr_1fr_1.2fr]">
                      <span className="flex size-6 items-center justify-center rounded-full bg-hover text-xs font-semibold text-ink-2">{s.step_number}</span>
                      <div>
                        {s.action}{' '}
                        {s.shared_step_id && (
                          <Badge tone="indigo" className="ml-1">
                            Reusable
                          </Badge>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap text-ink-3">{s.test_data || '—'}</div>
                      <div className="whitespace-pre-wrap text-ink-2">
                        <span className="text-xs text-ink-3 md:hidden">Expected: </span>
                        {s.expected_result}
                      </div>
                    </div>
                  ))}
                  {!tc.steps.length && <p className="px-4 py-4 text-[12.5px] text-ink-3">No steps.</p>}
                </div>
                <div className="grid gap-4 px-4 py-4 md:grid-cols-3">
                  <Block title="Preconditions">{tc.preconditions || 'None specified'}</Block>
                  <Block title="Expected result">{tc.expected_result || 'None specified'}</Block>
                  <Block title="Test data">{tc.test_data || 'None specified'}</Block>
                </div>
              </Card>
              <Card className="flex flex-col gap-1 p-4">
                <span className="caps mb-1">Details</span>
                <Prop name="Latest result">
                  <ResultBadge status={tc.status} />
                </Prop>
                <Prop name="Last run">{tc.last_executed_on ?? 'Never'}</Prop>
                <Prop name="Runs">{tc.execution_count}</Prop>
                <Prop name="Priority">
                  <Badge value={tc.priority} />
                </Prop>
                <Prop name="User story">
                  <Link href={`/issues/${tc.issue_id}`} className="block truncate text-accent-ink hover:underline">
                    {story.data ? `${story.data.issue_key} ${story.data.summary}` : 'View story'}
                  </Link>
                </Prop>
                {tc.ai_source?.source_commit && (
                  <Prop name="Generated from">
                    <span className="break-all font-mono text-xs">
                      {tc.ai_source.repository}
                      {tc.ai_source.module_path ? ` / ${tc.ai_source.module_path}` : ''} @{tc.ai_source.source_commit.slice(0, 7)}
                    </span>
                  </Prop>
                )}
                <span className="caps mb-1 mt-4">Covers acceptance criteria</span>
                {covered?.length ? (
                  <ul className="flex flex-col gap-1.5">
                    {covered.map((c) => (
                      <li key={c.id} className="flex items-start gap-2 text-[12.5px]">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-green-600" />
                        {c.description}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12.5px] text-ink-3">Not linked to any criterion. Edit the test to add coverage.</p>
                )}
              </Card>
            </div>
            <ExecutionHistory testCase={tc} />
          </div>
        )}
      </PageBody>
      {running && tc && <RunTestDialog testCase={tc} onClose={() => setRunning(false)} />}
    </>
  );
}
