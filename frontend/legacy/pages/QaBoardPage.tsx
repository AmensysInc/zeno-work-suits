import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card as Panel, Empty, Input, Tag, Typography } from 'antd';
import {
  BugOutlined,
  CaretRightOutlined,
  HolderOutlined,
} from '@ant-design/icons';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useData } from '../hooks/data';
import {
  label,
  runStatuses,
  testStatuses,
  type Execution,
  type Issue,
  type RunStatus,
  type Sprint,
  type TestCase,
  type TestStatus,
} from '../types';
import { fullName, isOpen, percent } from '../lib/qa';
import { PageHeader, State } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/form';
import { Kpi, Progress } from '../components/ui/charts';
import RunTestModal from '../components/testing/RunTestModal';

interface Item {
  test: TestCase;
  story?: Issue;
  run?: Execution;
  status: TestStatus;
  bugs: Issue[];
}

function Card({ item, onRun }: { item: Item; onRun: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: item.test.id });
  const { test, story, run, bugs } = item;
  return (
    <article
      className="issue-card"
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <div className="section-head">
        <Link className="key" to={`/test-cases/${test.id}`}>
          {test.test_case_key}
        </Link>
        <button
          className="drag-handle"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${test.test_case_key} to record a result`}
        >
          <HolderOutlined />
        </button>
      </div>
      <Link className="card-summary" to={`/test-cases/${test.id}`}>
        {test.title}
      </Link>
      {story && (
        <Link className="card-story" to={`/issues/${story.id}`}>
          {story.issue_key} · {story.summary}
        </Link>
      )}
      <div className="card-meta">
        <Typography.Text type="secondary">
          {run ? `${run.executed_on} · ${fullName(run.tester)}` : 'Not run yet'}
        </Typography.Text>
        {bugs.length > 0 && (
          <Tag
            color="error"
            icon={<BugOutlined />}
            title="Open defects from this test"
          >
            {bugs.length}
          </Tag>
        )}
      </div>
      <Button
        variant="outline"
        size="small"
        block
        icon={<CaretRightOutlined />}
        className="card-run"
        onClick={onRun}
      >
        Run
      </Button>
    </article>
  );
}

function Column({
  status,
  items,
  onRun,
}: {
  status: TestStatus;
  items: Item[];
  onRun: (item: Item) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    disabled: status === 'NOT_RUN',
  });
  return (
    <section
      ref={setNodeRef}
      className={`kanban-column qa-column-${status.toLowerCase()} ${isOver ? 'drop-over' : ''}`}
    >
      <div className="column-heading">
        <h3>{label(status)}</h3>
        <span>{items.length}</span>
      </div>
      {items.map((item) => (
        <Card key={item.test.id} item={item} onRun={() => onRun(item)} />
      ))}
      {!items.length && (
        <p className="column-empty">
          {status === 'NOT_RUN'
            ? 'Every test in scope has been run'
            : 'Drop a test here to record a result'}
        </p>
      )}
    </section>
  );
}

export default function QaBoardPage() {
  const pid = Number(useParams().projectId);
  const sprints = useData<Sprint[]>(`/projects/${pid}/sprints`);
  const tests = useData<TestCase[]>(`/test-cases?project_id=${pid}`);
  const runs = useData<Execution[]>(`/test-executions?project_id=${pid}`);
  const issues = useData<Issue[]>(`/issues?project_id=${pid}`);
  const [scope, setScope] = useState<number | 'all' | undefined>();
  const [story, setStory] = useState(0);
  const [search, setSearch] = useState('');
  const [running, setRunning] = useState<{
    item: Item;
    status?: RunStatus;
  } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const open = sprints.data?.filter((s) => s.status !== 'COMPLETED') ?? [];
  const sprintId =
    scope ??
    sprints.data?.find((s) => s.status === 'ACTIVE')?.id ??
    open.at(-1)?.id ??
    'all';
  const sprint = sprints.data?.find((s) => s.id === sprintId);
  const stories = new Map(
    issues.data
      ?.filter((i) => i.issue_type === 'STORY')
      .map((i) => [i.id, i]) ?? [],
  );
  // Runs arrive newest first, so the first match is the latest result.
  const scopedRuns =
    runs.data?.filter((r) => sprintId === 'all' || r.sprint_id === sprintId) ??
    [];
  const items: Item[] = (tests.data ?? [])
    .filter(
      (t) =>
        sprintId === 'all' ||
        stories.get(t.issue_id)?.sprint_id === sprintId ||
        scopedRuns.some((r) => r.test_case_id === t.id),
    )
    .map((test) => {
      const run = scopedRuns.find((r) => r.test_case_id === test.id);
      return {
        test,
        run,
        story: stories.get(test.issue_id),
        status: run?.status ?? 'NOT_RUN',
        bugs:
          issues.data?.filter(
            (i) =>
              i.issue_type === 'BUG' &&
              i.related_test_case_id === test.id &&
              isOpen(i.status),
          ) ?? [],
      };
    });
  const shown = items.filter(
    (i) =>
      (!story || i.test.issue_id === story) &&
      (!search ||
        `${i.test.test_case_key} ${i.test.title}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const count = (s: TestStatus) => items.filter((i) => i.status === s).length;
  const executed = items.length - count('NOT_RUN');
  const loading =
    sprints.isLoading || tests.isLoading || runs.isLoading || issues.isLoading;
  function end({ active, over }: DragEndEvent) {
    const item = items.find((i) => i.test.id === active.id);
    if (
      item &&
      over &&
      (runStatuses as readonly string[]).includes(String(over.id))
    )
      setRunning({ item, status: over.id as RunStatus });
  }
  return (
    <>
      <PageHeader
        title="QA Execution Board"
        description={
          sprint
            ? `${sprint.name} test cycle${sprint.start_date ? ` · ${sprint.start_date} — ${sprint.end_date}` : ''}`
            : 'Latest result of every test case in the project'
        }
      >
        <Select
          aria-label="Test cycle"
          className="inline-select"
          value={sprintId}
          onChange={(v) => setScope(v === 'all' ? 'all' : Number(v))}
          options={[
            ...(sprints.data ?? []).map((s) => ({
              value: s.id,
              label: `${s.name}${s.status === 'ACTIVE' ? ' (active)' : ''}${s.status === 'COMPLETED' ? ' (completed)' : ''}`,
            })),
            { value: 'all', label: 'All tests (latest run)' },
          ]}
        />
      </PageHeader>
      <State
        loading={loading}
        error={sprints.error || tests.error || runs.error || issues.error}
      />
      {!loading && (
        <>
          <div className="kpis">
            <Kpi name="Tests in cycle" value={items.length} />
            <Kpi
              name="Executed"
              value={`${percent(executed, items.length)}%`}
              hint={`${executed} of ${items.length}`}
            />
            <Kpi
              name="Pass rate"
              value={`${percent(count('PASSED'), executed)}%`}
              hint={`${count('PASSED')} passed of ${executed} run`}
              tone={
                executed && count('PASSED') === executed ? 'good' : undefined
              }
            />
            <Kpi
              name="Failing or blocked"
              value={count('FAILED') + count('BLOCKED')}
              tone={count('FAILED') + count('BLOCKED') ? 'bad' : 'good'}
            />
          </div>
          <Panel className="card">
            <Progress
              rows={testStatuses.map((s) => ({ key: s, count: count(s) }))}
            />
          </Panel>
          <div className="filters">
            <Input.Search
              allowClear
              aria-label="Search tests"
              placeholder="Search tests…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              aria-label="Filter by story"
              value={story}
              onChange={(v) => setStory(Number(v))}
              options={[
                { value: 0, label: 'All stories' },
                ...[...stories.values()]
                  .filter((s) => items.some((i) => i.test.issue_id === s.id))
                  .map((s) => ({
                    value: s.id,
                    label: `${s.issue_key} — ${s.summary}`,
                  })),
              ]}
            />
          </div>
          {items.length ? (
            <DndContext sensors={sensors} onDragEnd={end}>
              <div className="kanban">
                {testStatuses.map((s) => (
                  <Column
                    key={s}
                    status={s}
                    items={shown.filter((i) => i.status === s)}
                    onRun={(item) => setRunning({ item })}
                  />
                ))}
              </div>
            </DndContext>
          ) : (
            <Panel className="card">
              <Empty
                description={
                  <>
                    <strong>No tests in this cycle</strong>
                    <br />
                    Add stories with test cases to the sprint, or pick “All
                    tests”.
                  </>
                }
              />
            </Panel>
          )}
        </>
      )}
      {running && (
        <RunTestModal
          testCase={running.item.test}
          initialStatus={running.status}
          sprintId={typeof sprintId === 'number' ? sprintId : undefined}
          onClose={() => setRunning(null)}
        />
      )}
    </>
  );
}
