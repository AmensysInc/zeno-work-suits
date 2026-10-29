'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Bug, Search } from 'lucide-react';
import { useData, useSave } from '@/hooks/data';
import { label, priorities, statuses, type Execution, type Issue, type Project, type TestCase } from '@/types';
import { fullName, isOpen } from '@/lib/qa';
import { PageBar, PageBody, Toolbar } from '@/components/layout/page';
import { useCreateIssue } from '@/components/layout/context';
import { Avatar, Card, CardHeader, Empty, Kpi, State } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { IssueKey, PriorityIcon, PriorityLabel, StatusIcon, statusMeta } from '@/components/ui/glyphs';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { BarList } from '@/components/charts';

const priorityColor: Record<string, string> = { LOW: '#9ca3af', MEDIUM: '#3b82f6', HIGH: '#d97706', CRITICAL: '#e5484d' };
const PAGE = 25;

function StatusSelect({ bug }: { bug: Issue }) {
  const save = useSave(`/issues/${bug.id}/status`, 'patch', 'Bug updated');
  return (
    <Select<Issue['status']>
      size="sm"
      className="w-36"
      aria-label={`Status for ${bug.issue_key}`}
      value={bug.status}
      disabled={save.isPending}
      onChange={(v) => save.mutate({ status: v })}
      options={statuses.map((s) => ({ value: s, label: statusMeta[s].label, icon: <StatusIcon status={s} size={12} /> }))}
    />
  );
}

export default function BugsPage() {
  const pid = Number(useParams<{ projectId: string }>().projectId);
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
  const [page, setPage] = useState(0);
  const all = issues.data ?? [];
  const bugs = all.filter((i) => i.issue_type === 'BUG');
  const open = bugs.filter((b) => isOpen(b.status));
  const shown = bugs
    .filter(
      (b) =>
        (state === 'ALL' || (state === 'OPEN' ? isOpen(b.status) : b.status === state)) &&
        (!priority || b.priority === priority) &&
        (!assignee || String(b.assignee_id ?? 'none') === assignee) &&
        (!source || (source === 'test') === !!b.related_test_case_id) &&
        (!search || `${b.issue_key} ${b.summary}`.toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => priorities.indexOf(b.priority) - priorities.indexOf(a.priority) || b.updated_at.localeCompare(a.updated_at));
  const pages = Math.ceil(shown.length / PAGE);
  const current = Math.min(page, Math.max(0, pages - 1));
  const rows = shown.slice(current * PAGE, current * PAGE + PAGE);
  const fromTests = bugs.filter((b) => b.related_test_case_id).length;
  const critical = open.filter((b) => b.priority === 'CRITICAL').length;
  return (
    <>
      <PageBar
        crumbs={['Bugs']}
        projectId={pid}
        actions={
          <Button variant="primary" icon={<Bug />} onClick={() => create({ project_id: pid, issue_type: 'BUG', priority: 'HIGH' })}>
            Report bug
          </Button>
        }
      />
      <Toolbar>
        <Input size="sm" icon={<Search />} aria-label="Search bugs" placeholder="Search bugs…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-52" />
        <Select
          size="sm"
          aria-label="Filter by status"
          className="w-36"
          value={state}
          onChange={setState}
          options={[{ value: 'OPEN', label: 'Open' }, { value: 'ALL', label: 'All statuses' }, ...statuses.map((s) => ({ value: s, label: statusMeta[s].label }))]}
        />
        <Select size="sm" aria-label="Filter by priority" className="w-36" value={priority} onChange={setPriority} options={[{ value: '', label: 'All priorities' }, ...priorities.map((p) => ({ value: p, label: label(p) }))]} />
        <Select
          size="sm"
          aria-label="Filter by assignee"
          className="w-40"
          value={assignee}
          onChange={setAssignee}
          options={[{ value: '', label: 'Anyone' }, { value: 'none', label: 'Unassigned' }, ...(project.data?.members ?? []).map((u) => ({ value: String(u.id), label: fullName(u) }))]}
        />
        <Select
          size="sm"
          aria-label="Filter by source"
          className="w-40"
          value={source}
          onChange={setSource}
          options={[
            { value: '', label: 'Any source' },
            { value: 'test', label: 'Found by a test' },
            { value: 'direct', label: 'Reported directly' },
          ]}
        />
      </Toolbar>
      <PageBody>
        <State loading={issues.isLoading} error={issues.error} />
        {!issues.isLoading && (
          <div className="flex flex-col gap-4">
            <Card className="grid grid-cols-2 lg:grid-cols-4 [&>*]:border-line max-lg:[&>*:nth-child(even)]:border-l lg:[&>*:not(:first-child)]:border-l">
              <Kpi label="Open bugs" value={open.length} tone={open.length ? '#d97706' : '#16a34a'} />
              <Kpi label="Critical open" value={critical} tone={critical ? '#e5484d' : '#16a34a'} />
              <Kpi label="Fixed" value={bugs.length - open.length} hint={`of ${bugs.length} reported`} />
              <Kpi label="Found by tests" value={fromTests} hint={`${bugs.length - fromTests} reported directly`} />
            </Card>
            <div className="grid items-start gap-4 xl:grid-cols-[1fr_300px]">
              <Card className="overflow-hidden">
                {!shown.length ? (
                  <Empty icon={<Bug />} title={bugs.length ? 'No matches' : 'No bugs reported'}>
                    {bugs.length ? 'No bugs match these filters.' : 'Failed test runs can log one in a click.'}
                  </Empty>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th className="w-24">Key</Th>
                        <Th>Summary</Th>
                        <Th className="w-28">Priority</Th>
                        <Th className="w-40">Status</Th>
                        <Th className="w-40">Assignee</Th>
                        <Th className="w-24">Story</Th>
                        <Th className="w-40">Found by</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((b) => {
                        const story = all.find((i) => i.id === b.related_issue_id);
                        const test = tests.data?.find((t) => t.id === b.related_test_case_id);
                        const run = runs.data?.find((r) => r.id === b.related_execution_id);
                        return (
                          <Tr key={b.id}>
                            <Td>
                              <Link href={`/issues/${b.id}`} className="hover:underline">
                                <IssueKey>{b.issue_key}</IssueKey>
                              </Link>
                            </Td>
                            <Td className="max-w-0">
                              <Link href={`/issues/${b.id}`} className="block truncate font-medium hover:text-accent-ink">
                                {b.summary}
                              </Link>
                            </Td>
                            <Td className="whitespace-nowrap text-ink-2">
                              <PriorityLabel priority={b.priority} />
                            </Td>
                            <Td>
                              <StatusSelect bug={b} />
                            </Td>
                            <Td>
                              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                                <Avatar user={b.assignee} size={20} />
                                {fullName(b.assignee)}
                              </span>
                            </Td>
                            <Td>
                              {story ? (
                                <Link href={`/issues/${story.id}`} title={story.summary} className="hover:underline">
                                  <IssueKey>{story.issue_key}</IssueKey>
                                </Link>
                              ) : (
                                <span className="text-ink-4">—</span>
                              )}
                            </Td>
                            <Td className="whitespace-nowrap text-xs">
                              {test ? (
                                <Link href={`/test-cases/${test.id}${run ? `#run-${run.id}` : ''}`} title={test.title} className="text-accent-ink hover:underline">
                                  {test.test_case_key}
                                  {run && ` · run ${run.executed_on}`}
                                </Link>
                              ) : (
                                <span className="text-ink-3">Reported</span>
                              )}
                            </Td>
                          </Tr>
                        );
                      })}
                    </tbody>
                  </Table>
                )}
                {pages > 1 && (
                  <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-ink-3">
                    <span>
                      {current * PAGE + 1}–{Math.min(shown.length, current * PAGE + PAGE)} of {shown.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" disabled={!current} onClick={() => setPage(current - 1)}>
                        Prev
                      </Button>
                      <Button size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
              <div className="flex flex-col gap-4">
                <Card className="pb-4">
                  <CardHeader title="Open bugs by priority" />
                  <div className="px-4 pt-3">
                    <BarList labelWidth={72} rows={[...priorities].reverse().map((p) => ({ label: label(p), value: open.filter((b) => b.priority === p).length, color: priorityColor[p], icon: <PriorityIcon priority={p} /> }))} />
                  </div>
                </Card>
                <Card className="pb-4">
                  <CardHeader title="Bugs by status" />
                  <div className="px-4 pt-3">
                    <BarList labelWidth={84} rows={statuses.map((s) => ({ label: statusMeta[s].label, value: bugs.filter((b) => b.status === s).length, color: statusMeta[s].color, icon: <StatusIcon status={s} /> }))} />
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
