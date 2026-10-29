'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CirclePlay, Network } from 'lucide-react';
import { useData } from '@/hooks/data';
import { label, priorities, testStatuses, type Execution, type Issue, type Project, type Traceability } from '@/types';
import { fullName, healthLabel, isOpen, percent, storyHealth, testColor } from '@/lib/qa';
import { PageBar, PageBody } from '@/components/layout/page';
import { Avatar, Badge, Card, CardHeader, Empty, Kpi, State } from '@/components/ui/display';
import { LinkButton } from '@/components/ui/button';
import { IssueKey, PriorityIcon, ResultBadge } from '@/components/ui/glyphs';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { BarList, StackedBar } from '@/components/charts';

const priorityColor: Record<string, string> = { LOW: '#9ca3af', MEDIUM: '#3b82f6', HIGH: '#d97706', CRITICAL: '#e5484d' };

export default function QaDashboardPage() {
  const pid = Number(useParams<{ projectId: string }>().projectId);
  const project = useData<Project>(`/projects/${pid}`);
  const trace = useData<Traceability>(`/projects/${pid}/traceability`);
  const runs = useData<Execution[]>(`/test-executions?project_id=${pid}`);
  const issues = useData<Issue[]>(`/issues?project_id=${pid}`);
  const loading = trace.isLoading || runs.isLoading || issues.isLoading;
  const error = trace.error || runs.error || issues.error;
  const bar = (
    <PageBar
      crumbs={['QA dashboard']}
      projectId={pid}
      actions={
        <>
          <LinkButton href={`/projects/${pid}/traceability`} icon={<Network className="size-3.5" />}>
            <span className="hidden sm:inline">Traceability</span>
          </LinkButton>
          <LinkButton variant="primary" href={`/projects/${pid}/test-runs`} icon={<CirclePlay className="size-3.5" />}>
            Run tests
          </LinkButton>
        </>
      }
    />
  );
  if (!trace.data || !runs.data || !issues.data)
    return (
      <>
        {bar}
        <PageBody>
          <State loading={loading} error={error} />
        </PageBody>
      </>
    );
  const stories = trace.data.stories;
  const tests = stories.flatMap((s) => s.test_cases);
  const criteria = stories.flatMap((s) => s.criteria);
  const openBugs = issues.data.filter((i) => i.issue_type === 'BUG' && isOpen(i.status));
  const count = (status: string) => tests.filter((t) => t.status === status).length;
  const executed = tests.length - count('NOT_RUN');
  const atRisk = stories.filter((s) => storyHealth(s) !== 'READY');
  const since = new Date(Date.now() - 14 * 864e5).toLocaleDateString('en-CA');
  const recent = runs.data.filter((r) => r.executed_on >= since);
  const testers = [...new Map(recent.map((r) => [r.tester_id, r.tester])).values()];
  const critical = openBugs.filter((b) => b.priority === 'CRITICAL').length;
  return (
    <>
      {bar}
      <PageBody>
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-ink-2">Quality at a glance for {project.data?.name ?? 'this project'}.</p>
          <Card className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 [&>*]:border-line max-md:[&>*:nth-child(even)]:border-l md:max-xl:[&>*:not(:nth-child(3n+1))]:border-l xl:[&>*:not(:first-child)]:border-l">
            <Kpi label="Requirement coverage" value={`${percent(stories.filter((s) => s.test_cases.length).length, stories.length)}%`} hint={`${stories.filter((s) => !s.test_cases.length).length} stories without tests`} />
            <Kpi label="Criteria coverage" value={`${percent(criteria.filter((c) => c.test_case_ids.length).length, criteria.length)}%`} hint={`${criteria.length} acceptance criteria`} />
            <Kpi label="Execution progress" value={`${percent(executed, tests.length)}%`} hint={`${executed} of ${tests.length} tests run`} />
            <Kpi label="Pass rate" value={`${percent(count('PASSED'), executed)}%`} hint="of executed tests" tone={!executed ? undefined : count('PASSED') === executed ? '#16a34a' : '#d97706'} />
            <Kpi label="Open defects" value={openBugs.length} hint={`${critical} critical`} tone={critical ? '#e5484d' : openBugs.length ? '#d97706' : '#16a34a'} />
            <Kpi label="Stories ready" value={`${stories.length - atRisk.length}/${stories.length}`} hint="covered, passing, no open bugs" />
          </Card>

          <Card className="pb-4">
            <CardHeader title="Latest test results" subtitle={`${tests.length} test cases`} />
            <div className="px-4 pt-3">
              <StackedBar parts={testStatuses.map((s) => ({ label: label(s), value: count(s), color: testColor[s] }))} />
            </div>
          </Card>

          <div className="grid items-start gap-4 xl:grid-cols-[1.6fr_1fr]">
            <Card className="overflow-hidden">
              <CardHeader
                title="Stories needing attention"
                subtitle="Coverage gaps, failing tests or open bugs"
                className="pb-3"
                action={
                  <Link href={`/projects/${pid}/traceability`} className="text-xs font-medium text-accent-ink hover:underline">
                    View all →
                  </Link>
                }
              />
              {!atRisk.length ? (
                <Empty title="All clear">Every story is covered, passing and free of open bugs.</Empty>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th className="w-24">Story</Th>
                      <Th>Summary</Th>
                      <Th className="text-right">Criteria</Th>
                      <Th className="text-right">Failing</Th>
                      <Th className="text-right">Bugs</Th>
                      <Th>Health</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {atRisk.slice(0, 8).map((s) => {
                      const health = storyHealth(s);
                      return (
                        <Tr key={s.id}>
                          <Td>
                            <Link href={`/projects/${pid}/traceability?story=${s.id}`} className="hover:underline">
                              <IssueKey>{s.issue_key}</IssueKey>
                            </Link>
                          </Td>
                          <Td className="max-w-0">
                            <Link href={`/issues/${s.id}`} className="block truncate font-medium hover:text-accent-ink">
                              {s.summary}
                            </Link>
                          </Td>
                          <Td className="tnum text-right">
                            {s.criteria.filter((c) => c.test_case_ids.length).length}/{s.criteria.length}
                          </Td>
                          <Td className="tnum text-right">
                            {s.test_cases.filter((t) => ['FAILED', 'BLOCKED'].includes(t.status)).length}/{s.test_cases.length}
                          </Td>
                          <Td className="tnum text-right">{s.bugs.filter((b) => isOpen(b.status)).length}</Td>
                          <Td>
                            <Badge value={health}>{healthLabel[health]}</Badge>
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </Card>
            <div className="flex flex-col gap-4">
              <Card className="pb-4">
                <CardHeader title="Open defects by priority" />
                <div className="px-4 pt-3">
                  <BarList
                    labelWidth={80}
                    rows={[...priorities].reverse().map((p) => ({ label: label(p), value: openBugs.filter((b) => b.priority === p).length, color: priorityColor[p], icon: <PriorityIcon priority={p} />, href: `/projects/${pid}/bugs` }))}
                  />
                </div>
              </Card>
              <Card className="pb-4">
                <CardHeader title="Runs per tester" subtitle="Last 14 days" />
                <div className="px-4 pt-3">
                  {testers.length ? (
                    <BarList labelWidth={96} rows={testers.map((u) => ({ label: u.first_name, value: recent.filter((r) => r.tester_id === u.id).length, icon: <Avatar user={u} size={18} /> }))} />
                  ) : (
                    <p className="py-3 text-center text-[12.5px] text-ink-3">No runs in the last 14 days.</p>
                  )}
                </div>
              </Card>
            </div>
          </div>

          <Card className="overflow-hidden">
            <CardHeader title="Recent test runs" className="pb-3" />
            {!runs.data.length ? (
              <Empty title="No runs yet">No tests have been run yet. Open the execution board to start.</Empty>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th className="w-28">Date</Th>
                    <Th>Test case</Th>
                    <Th className="w-28">Result</Th>
                    <Th className="w-40">Tester</Th>
                    <Th>Actual result</Th>
                  </tr>
                </thead>
                <tbody>
                  {runs.data.slice(0, 8).map((r) => (
                    <Tr key={r.id}>
                      <Td className="whitespace-nowrap text-ink-3">{r.executed_on}</Td>
                      <Td className="max-w-0">
                        <Link href={`/test-cases/${r.test_case_id}#run-${r.id}`} className="block truncate hover:text-accent-ink">
                          <IssueKey>{r.test_case_key}</IssueKey> <span className="font-medium">{r.test_case_title}</span>
                        </Link>
                      </Td>
                      <Td>
                        <ResultBadge status={r.status} />
                      </Td>
                      <Td>
                        <span className="inline-flex items-center gap-2 whitespace-nowrap">
                          <Avatar user={r.tester} size={20} />
                          {fullName(r.tester)}
                        </span>
                      </Td>
                      <Td className="text-ink-2">{r.actual_result || '—'}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}
