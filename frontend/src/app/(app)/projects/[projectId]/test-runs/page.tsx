'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Bug, FlaskConical, GripVertical, Play, Search } from 'lucide-react';
import { useData } from '@/hooks/data';
import { label, runStatuses, testStatuses, type Execution, type Issue, type RunStatus, type Sprint, type TestCase, type TestStatus } from '@/types';
import { fullName, isOpen, percent, testColor } from '@/lib/qa';
import { PageBar, PageBody, Toolbar } from '@/components/layout/page';
import { Avatar, Badge, Card, Empty, Kpi, State } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { IssueKey } from '@/components/ui/glyphs';
import { StackedBar } from '@/components/charts';
import RunTestDialog from '@/components/testing/run-test-dialog';
import { cn } from '@/lib/utils';

interface Item {
  test: TestCase;
  story?: Issue;
  run?: Execution;
  status: TestStatus;
  bugs: Issue[];
}

function TestCard({ item, onRun }: { item: Item; onRun: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.test.id });
  const { test, story, run, bugs } = item;
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn('flex flex-col gap-2 rounded-[9px] border border-line bg-surface px-3 py-2.5 shadow-sm', isDragging && 'relative z-10 rotate-[-2deg] shadow-lg ring-1 ring-accent')}
    >
      <div className="flex items-center justify-between gap-2">
        <Link href={`/test-cases/${test.id}`} className="hover:underline">
          <IssueKey>{test.test_case_key}</IssueKey>
        </Link>
        <button {...attributes} {...listeners} aria-label={`Drag ${test.test_case_key} to record a result`} className="cursor-grab touch-none text-ink-4 hover:text-ink-2">
          <GripVertical className="size-3.5" />
        </button>
      </div>
      <Link href={`/test-cases/${test.id}`} className="text-[13px] font-medium leading-snug hover:text-accent-ink">
        {test.title}
      </Link>
      {story && (
        <Link href={`/issues/${story.id}`} className="truncate text-[11.5px] text-ink-3 hover:text-ink">
          {story.issue_key} · {story.summary}
        </Link>
      )}
      <div className="flex items-center gap-2">
        {run ? <Avatar user={run.tester} size={18} /> : null}
        <span className="flex-1 truncate text-[11.5px] text-ink-3">{run ? `${run.executed_on} · ${fullName(run.tester)}` : 'Not run yet'}</span>
        {bugs.length > 0 && (
          <Badge tone="red" icon={<Bug />}>
            {bugs.length}
          </Badge>
        )}
        <Button size="sm" icon={<Play />} onClick={onRun}>
          Run
        </Button>
      </div>
    </article>
  );
}

function Column({ status, items, onRun }: { status: TestStatus; items: Item[]; onRun: (item: Item) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: status === 'NOT_RUN' });
  return (
    <section ref={setNodeRef} className={cn('flex w-[272px] shrink-0 flex-col gap-2 lg:w-auto lg:min-w-0 lg:flex-1', isOver && 'rounded-xl bg-accent-soft/60 ring-2 ring-accent/40')}>
      <div className="flex h-[30px] items-center gap-2 px-1 text-[13px] font-semibold">
        <i className="block size-2.5 rounded-full" style={{ background: testColor[status] }} />
        {label(status)}
        <span className="font-medium text-ink-3">{items.length}</span>
      </div>
      {items.map((item) => (
        <TestCard key={item.test.id} item={item} onRun={() => onRun(item)} />
      ))}
      {!items.length && (
        <p className="flex h-14 items-center justify-center rounded-[9px] border-[1.5px] border-dashed border-line-2 px-2 text-center text-[12px] text-ink-3">
          {status === 'NOT_RUN' ? 'Every test in scope has been run' : 'Drop a test here to record a result'}
        </p>
      )}
    </section>
  );
}

export default function QaBoardPage() {
  const pid = Number(useParams<{ projectId: string }>().projectId);
  const sprints = useData<Sprint[]>(`/projects/${pid}/sprints`);
  const tests = useData<TestCase[]>(`/test-cases?project_id=${pid}`);
  const runs = useData<Execution[]>(`/test-executions?project_id=${pid}`);
  const issues = useData<Issue[]>(`/issues?project_id=${pid}`);
  const [scope, setScope] = useState<number | 'all' | undefined>();
  const [story, setStory] = useState(0);
  const [search, setSearch] = useState('');
  const [running, setRunning] = useState<{ item: Item; status?: RunStatus } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const open = sprints.data?.filter((s) => s.status !== 'COMPLETED') ?? [];
  const sprintId = scope ?? sprints.data?.find((s) => s.status === 'ACTIVE')?.id ?? open.at(-1)?.id ?? 'all';
  const sprint = sprints.data?.find((s) => s.id === sprintId);
  const stories = new Map(issues.data?.filter((i) => i.issue_type === 'STORY').map((i) => [i.id, i]) ?? []);
  // Runs arrive newest first, so the first match is the latest result.
  const scopedRuns = runs.data?.filter((r) => sprintId === 'all' || r.sprint_id === sprintId) ?? [];
  const items: Item[] = (tests.data ?? [])
    .filter((t) => sprintId === 'all' || stories.get(t.issue_id)?.sprint_id === sprintId || scopedRuns.some((r) => r.test_case_id === t.id))
    .map((test) => {
      const run = scopedRuns.find((r) => r.test_case_id === test.id);
      return {
        test,
        run,
        story: stories.get(test.issue_id),
        status: run?.status ?? 'NOT_RUN',
        bugs: issues.data?.filter((i) => i.issue_type === 'BUG' && i.related_test_case_id === test.id && isOpen(i.status)) ?? [],
      };
    });
  const shown = items.filter((i) => (!story || i.test.issue_id === story) && (!search || `${i.test.test_case_key} ${i.test.title}`.toLowerCase().includes(search.toLowerCase())));
  const count = (s: TestStatus) => items.filter((i) => i.status === s).length;
  const executed = items.length - count('NOT_RUN');
  const loading = sprints.isLoading || tests.isLoading || runs.isLoading || issues.isLoading;
  function end({ active, over }: DragEndEvent) {
    const item = items.find((i) => i.test.id === active.id);
    if (item && over && (runStatuses as readonly string[]).includes(String(over.id))) setRunning({ item, status: over.id as RunStatus });
  }
  return (
    <>
      <PageBar
        crumbs={['Test runs']}
        projectId={pid}
        actions={
          <Select<number | 'all'>
            aria-label="Test cycle"
            className="w-56"
            value={sprintId}
            onChange={setScope}
            options={[
              ...(sprints.data ?? []).map((s) => ({ value: s.id, label: `${s.name}${s.status === 'ACTIVE' ? ' (active)' : ''}${s.status === 'COMPLETED' ? ' (completed)' : ''}` })),
              { value: 'all' as const, label: 'All tests (latest run)' },
            ]}
          />
        }
      />
      {!loading && (
        <Toolbar>
          <Input size="sm" icon={<Search />} aria-label="Search tests" placeholder="Search tests…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
          <Select<number>
            size="sm"
            aria-label="Filter by story"
            className="w-64"
            value={story}
            onChange={setStory}
            options={[
              { value: 0, label: 'All stories' },
              ...[...stories.values()].filter((s) => items.some((i) => i.test.issue_id === s.id)).map((s) => ({ value: s.id, label: `${s.issue_key} — ${s.summary}` })),
            ]}
          />
          <span className="ml-auto text-xs text-ink-3">{sprint ? `${sprint.name} test cycle${sprint.start_date ? ` · ${sprint.start_date} — ${sprint.end_date}` : ''}` : 'Latest result of every test case in the project'}</span>
        </Toolbar>
      )}
      <PageBody padded={false} className="flex flex-col">
        <State loading={loading} error={sprints.error || tests.error || runs.error || issues.error} />
        {!loading && (
          <>
            <div className="flex flex-col gap-3 px-3 pt-3.5 sm:px-4">
              <Card className="grid grid-cols-2 lg:grid-cols-[repeat(4,1fr)_2fr] [&>*]:border-line max-lg:[&>*:nth-child(even)]:border-l lg:[&>*:not(:first-child)]:border-l">
                <Kpi label="Tests in cycle" value={items.length} />
                <Kpi label="Executed" value={`${percent(executed, items.length)}%`} hint={`${executed} of ${items.length}`} />
                <Kpi label="Pass rate" value={`${percent(count('PASSED'), executed)}%`} hint={`${count('PASSED')} passed of ${executed} run`} tone={executed && count('PASSED') === executed ? '#16a34a' : undefined} />
                <Kpi label="Failing or blocked" value={count('FAILED') + count('BLOCKED')} tone={count('FAILED') + count('BLOCKED') ? '#e5484d' : '#16a34a'} />
                <div className="col-span-2 flex flex-col justify-center px-4 py-3.5 lg:col-span-1">
                  <StackedBar height={8} parts={testStatuses.map((s) => ({ label: label(s), value: count(s), color: testColor[s] }))} />
                </div>
              </Card>
            </div>
            {items.length ? (
              <DndContext sensors={sensors} onDragEnd={end}>
                <div className="scrollbar-thin flex flex-1 items-start gap-3 overflow-x-auto px-3 py-3.5 sm:px-4">
                  {testStatuses.map((s) => (
                    <Column key={s} status={s} items={shown.filter((i) => i.status === s)} onRun={(item) => setRunning({ item })} />
                  ))}
                </div>
              </DndContext>
            ) : (
              <Empty icon={<FlaskConical />} title="No tests in this cycle">
                Add stories with test cases to the sprint, or pick “All tests”.
              </Empty>
            )}
          </>
        )}
      </PageBody>
      {running && <RunTestDialog testCase={running.item.test} initialStatus={running.status} sprintId={typeof sprintId === 'number' ? sprintId : undefined} onClose={() => setRunning(null)} />}
    </>
  );
}
