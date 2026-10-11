import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
          ⠿
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
        <span className="muted">
          {run ? `${run.executed_on} · ${fullName(run.tester)}` : 'Not run yet'}
        </span>
        {bugs.length > 0 && (
          <span className="error" title="Open defects from this test">
            🐞 {bugs.length}
          </span>
        )}
      </div>
      <Button variant="outline" className="card-run" onClick={onRun}>
        ▶ Run
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
        <select
          aria-label="Test cycle"
          value={sprintId}
          onChange={(e) =>
            setScope(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
        >
          {sprints.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.status === 'ACTIVE' ? ' (active)' : ''}
              {s.status === 'COMPLETED' ? ' (completed)' : ''}
            </option>
          ))}
          <option value="all">All tests (latest run)</option>
        </select>
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
          <section className="card">
            <Progress
              rows={testStatuses.map((s) => ({ key: s, count: count(s) }))}
            />
          </section>
          <div className="filters">
            <input
              type="search"
              aria-label="Search tests"
              placeholder="Search tests…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Filter by story"
              value={story}
              onChange={(e) => setStory(Number(e.target.value))}
            >
              <option value={0}>All stories</option>
              {[...stories.values()]
                .filter((s) => items.some((i) => i.test.issue_id === s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.issue_key} — {s.summary}
                  </option>
                ))}
            </select>
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
            <section className="card empty">
              <h2>No tests in this cycle</h2>
              <p>
                Add stories with test cases to the sprint, or pick “All tests”.
              </p>
            </section>
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
