'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronRight, Network } from 'lucide-react';
import { useData } from '@/hooks/data';
import { label, type Sprint, type Traceability, type TraceStory } from '@/types';
import { fullName, healthLabel, isOpen, percent, storyHealth, testColor } from '@/lib/qa';
import { PageBar, PageBody, Toolbar } from '@/components/layout/page';
import { Badge, Card, Empty, Kpi, State } from '@/components/ui/display';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/controls';
import { IssueKey, StatusIcon } from '@/components/ui/glyphs';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { cn } from '@/lib/utils';

function TestChip({ test }: { test: TraceStory['test_cases'][number] }) {
  const color = testColor[test.status];
  return (
    <Link
      href={`/test-cases/${test.id}`}
      title={`${test.title} · ${label(test.status)}${test.last_execution ? ` · ${test.last_execution.executed_on} by ${fullName(test.last_execution.tester)}` : ''}`}
      className="inline-flex h-5 items-center gap-1 rounded-[5px] border px-1.5 font-mono text-[11px] font-medium hover:opacity-80"
      style={{ color: test.status === 'NOT_RUN' ? 'var(--ink-3)' : color, borderColor: `${color}66`, background: `${color}14` }}
    >
      <i className="block size-1.5 rounded-full" style={{ background: color }} />
      {test.test_case_key}
    </Link>
  );
}

function IssueRow({ issue, extra }: { issue: TraceStory['bugs'][number]; extra?: string }) {
  return (
    <li className="flex items-center gap-2 py-1 text-[12.5px]">
      <StatusIcon status={issue.status} size={13} />
      <Link href={`/issues/${issue.id}`} className="hover:underline">
        <IssueKey>{issue.issue_key}</IssueKey>
      </Link>
      <span className="min-w-0 flex-1 truncate">{issue.summary}</span>
      {extra && <span className="text-xs text-ink-3">{extra}</span>}
    </li>
  );
}

function Detail({ story }: { story: TraceStory }) {
  const unlinked = story.test_cases.filter((t) => !t.criterion_ids.length);
  return (
    <div className="grid gap-6 bg-subtle px-4 py-4 sm:pl-12 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-2">
        <span className="caps">Acceptance criteria → tests → results</span>
        {!story.criteria.length && <p className="text-[12.5px] text-amber-600">No acceptance criteria. Add them on the story to measure coverage.</p>}
        <ol className="flex flex-col gap-1.5">
          {story.criteria.map((c, i) => (
            <li key={c.id} className="flex flex-wrap items-start gap-2 rounded-md border border-line bg-surface px-3 py-2 text-[12.5px]">
              <span className="tnum text-ink-3">{i + 1}.</span>
              <span className={cn('min-w-0 flex-1', c.completed && 'text-ink-3 line-through')}>{c.description}</span>
              <span className="flex flex-wrap gap-1">
                {c.test_case_ids.length ? story.test_cases.filter((t) => c.test_case_ids.includes(t.id)).map((t) => <TestChip key={t.id} test={t} />) : <Badge value="GAP">No test</Badge>}
              </span>
            </li>
          ))}
        </ol>
        {!!unlinked.length && (
          <p className="flex flex-wrap items-center gap-1 text-xs text-ink-3">
            Not linked to a criterion:
            {unlinked.map((t) => (
              <TestChip key={t.id} test={t} />
            ))}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <span className="caps">Development</span>
          {story.subtasks.length ? (
            <ul className="mt-1">
              {story.subtasks.map((s) => (
                <IssueRow key={s.id} issue={s} />
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[12.5px] text-ink-3">No development subtasks.</p>
          )}
        </div>
        <div>
          <span className="caps">Defects</span>
          {story.bugs.length ? (
            <ul className="mt-1">
              {story.bugs.map((b) => {
                const test = story.test_cases.find((t) => t.id === b.related_test_case_id);
                return <IssueRow key={b.id} issue={b} extra={test ? `from ${test.test_case_key}` : undefined} />;
              })}
            </ul>
          ) : (
            <p className="mt-1 text-[12.5px] text-ink-3">No defects linked.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TraceabilityPage() {
  const pid = Number(useParams<{ projectId: string }>().projectId);
  const params = useSearchParams();
  const query = useData<Traceability>(`/projects/${pid}/traceability`);
  const sprints = useData<Sprint[]>(`/projects/${pid}/sprints`);
  const [epic, setEpic] = useState(0);
  const [sprint, setSprint] = useState(0);
  const [gapsOnly, setGapsOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([Number(params.get('story'))].filter(Boolean)));
  const data = query.data;
  const toggle = (id: number) =>
    setExpanded((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const bar = <PageBar crumbs={['Traceability']} projectId={pid} />;
  if (!data)
    return (
      <>
        {bar}
        <PageBody>
          <State loading={query.isLoading} error={query.error} />
        </PageBody>
      </>
    );
  const stories = data.stories.filter((s) => (!epic || s.epic_id === epic) && (!sprint || s.sprint_id === sprint) && (!gapsOnly || storyHealth(s) !== 'READY'));
  const criteria = data.stories.flatMap((s) => s.criteria);
  const tests = data.stories.flatMap((s) => s.test_cases);
  const bugs = data.stories.flatMap((s) => s.bugs);
  const openBugs = bugs.filter((b) => isOpen(b.status)).length;
  return (
    <>
      {bar}
      <Toolbar>
        <Select<number>
          size="sm"
          aria-label="Filter by epic"
          className="w-64"
          value={epic}
          onChange={setEpic}
          options={[{ value: 0, label: 'All epics' }, ...data.epics.map((e) => ({ value: e.id, label: `${e.issue_key} — ${e.summary}` }))]}
        />
        <Select<number> size="sm" aria-label="Filter by sprint" className="w-44" value={sprint} onChange={setSprint} options={[{ value: 0, label: 'All sprints' }, ...(sprints.data ?? []).map((s) => ({ value: s.id, label: s.name }))]} />
        <Switch checked={gapsOnly} onChange={setGapsOnly} label="Only stories that need attention" />
      </Toolbar>
      <PageBody>
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-ink-2">Follow each requirement through development, testing and defects.</p>
          <Card className="grid grid-cols-2 lg:grid-cols-4 [&>*]:border-line max-lg:[&>*:nth-child(even)]:border-l lg:[&>*:not(:first-child)]:border-l">
            <Kpi label="Stories with tests" value={`${percent(data.stories.filter((s) => s.test_cases.length).length, data.stories.length)}%`} hint={`${data.stories.length} stories`} />
            <Kpi label="Criteria covered" value={`${percent(criteria.filter((c) => c.test_case_ids.length).length, criteria.length)}%`} hint={`${criteria.filter((c) => !c.test_case_ids.length).length} without a test`} />
            <Kpi label="Tests passing" value={`${percent(tests.filter((t) => t.status === 'PASSED').length, tests.length)}%`} hint={`${tests.length} tests`} />
            <Kpi label="Open defects" value={openBugs} tone={openBugs ? '#d97706' : '#16a34a'} />
          </Card>
          <Card className="overflow-hidden">
            {!stories.length ? (
              <Empty icon={<Network />} title={data.stories.length ? 'All clear' : 'No user stories yet'}>
                {data.stories.length ? 'Every story matching these filters is ready.' : 'Create stories with acceptance criteria to trace them.'}
              </Empty>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th className="w-8" />
                    <Th className="w-24">Story</Th>
                    <Th>Requirement</Th>
                    <Th className="w-40">Development</Th>
                    <Th className="w-28">Criteria</Th>
                    <Th>Tests · latest result</Th>
                    <Th className="w-28">Defects</Th>
                    <Th className="w-32">Health</Th>
                  </tr>
                </thead>
                <tbody>
                  {stories.map((s) => {
                    const open = expanded.has(s.id);
                    const done = s.subtasks.filter((t) => t.status === 'DONE').length;
                    const covered = s.criteria.filter((c) => c.test_case_ids.length).length;
                    const sOpenBugs = s.bugs.filter((b) => isOpen(b.status)).length;
                    const health = storyHealth(s);
                    return (
                      <Fragment key={s.id}>
                        <Tr selected={open} onClick={() => toggle(s.id)}>
                          <Td>
                            <button aria-label={open ? 'Collapse' : 'Expand'} aria-expanded={open} className="text-ink-3">
                              {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            </button>
                          </Td>
                          <Td onClick={(e) => e.stopPropagation()}>
                            <Link href={`/issues/${s.id}`} className="hover:underline">
                              <IssueKey>{s.issue_key}</IssueKey>
                            </Link>
                          </Td>
                          <Td className="max-w-0">
                            <span className="block truncate font-medium">{s.summary}</span>
                            <span className="text-xs text-ink-3">
                              {label(s.priority)} · {fullName(s.assignee)}
                            </span>
                          </Td>
                          <Td>
                            <Badge value={s.status} />
                            <div className="mt-0.5 text-xs text-ink-3">{s.subtasks.length ? `${done}/${s.subtasks.length} subtasks done` : 'No subtasks'}</div>
                          </Td>
                          <Td className={cn('tnum text-[12.5px]', covered < s.criteria.length || !s.criteria.length ? 'text-amber-600' : 'text-ink-2')}>
                            {s.criteria.length ? `${covered}/${s.criteria.length}` : 'None defined'}
                          </Td>
                          <Td onClick={(e) => e.stopPropagation()}>
                            <span className="flex flex-wrap gap-1">{s.test_cases.length ? s.test_cases.map((t) => <TestChip key={t.id} test={t} />) : <span className="text-[12.5px] text-amber-600">No tests</span>}</span>
                          </Td>
                          <Td className={cn('text-[12.5px]', sOpenBugs ? 'font-medium text-red-600' : 'text-ink-3')}>{s.bugs.length ? `${sOpenBugs} open / ${s.bugs.length}` : '—'}</Td>
                          <Td>
                            <Badge value={health}>{healthLabel[health]}</Badge>
                          </Td>
                        </Tr>
                        {open && (
                          <tr>
                            <td colSpan={8} className="border-b border-line p-0">
                              <Detail story={s} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}
