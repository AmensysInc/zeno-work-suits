import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link } from 'react-router-dom';
import type { Issue, Sprint } from '../../types';
import { Badge } from '../ui/shared';
import { useMoveIssue } from '../../hooks/useMoveIssue';
function Item({
  issue,
  sprints,
  move,
  disabled,
}: {
  issue: Issue;
  sprints: Sprint[];
  move: (id: number, sprint_id: number | null) => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: issue.id, disabled });
  return (
    <div
      className="planning-item"
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        className="drag-handle"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${issue.issue_key}`}
      >
        ⠿
      </button>
      <div>
        <Link to={`/issues/${issue.id}`}>
          <span className="key">{issue.issue_key}</span>
          <strong>{issue.summary}</strong>
        </Link>
        <div className="actions">
          <Badge value={issue.issue_type} />
          <span className="muted">{issue.story_points} pts</span>
        </div>
      </div>
      <select
        aria-label={`Sprint for ${issue.issue_key}`}
        disabled={disabled}
        value={issue.sprint_id ?? ''}
        onChange={(e) =>
          move(issue.id, e.target.value ? Number(e.target.value) : null)
        }
      >
        <option value="">Backlog</option>
        {sprints
          .filter((s) => s.status !== 'COMPLETED')
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
      </select>
    </div>
  );
}
function Zone({
  id,
  title,
  items,
  sprints,
  move,
  disabled,
}: {
  id: string;
  title: string;
  items: Issue[];
  sprints: Sprint[];
  move: (id: number, sprint: number | null) => void;
  disabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  return (
    <section
      ref={setNodeRef}
      className={`card planning-zone ${isOver ? 'drop-over' : ''}`}
    >
      <div className="section-head">
        <h3>{title}</h3>
        <span className="muted">
          {items.length} issues ·{' '}
          {items.reduce((n, i) => n + i.story_points, 0)} pts
        </span>
      </div>
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        {items.map((i) => (
          <Item
            key={i.id}
            issue={i}
            sprints={sprints}
            move={move}
            disabled={disabled}
          />
        ))}
      </SortableContext>
      {!items.length && <div className="empty">Drop issues here</div>}
    </section>
  );
}
export default function PlanningBoard({
  projectId,
  issues,
  sprints,
  selected,
}: {
  projectId: number;
  issues: Issue[];
  sprints: Sprint[];
  selected: Sprint;
}) {
  const mutation = useMoveIssue(projectId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const eligible = issues.filter((i) => i.issue_type !== 'EPIC');
  const sorted = (items: Issue[]) =>
    [...items].sort((a, b) => a.order_index - b.order_index || a.id - b.id);
  const move = (id: number, sprint_id: number | null) =>
    mutation.mutate({ id, patch: { sprint_id } });
  const disabled = selected.status === 'COMPLETED' || mutation.isPending;
  function end({ active, over }: DragEndEvent) {
    if (!over || disabled) return;
    const current = issues.find((i) => i.id === active.id);
    if (!current) return;
    const target = issues.find((i) => i.id === over.id);
    const sprint_id = target
      ? target.sprint_id
      : over.id === 'backlog'
        ? null
        : selected.id;
    let order_index = Date.now();
    if (target && target.id !== current.id) {
      const list = sorted(
        eligible.filter(
          (i) => i.sprint_id === sprint_id && i.id !== current.id,
        ),
      );
      const index = list.findIndex((i) => i.id === target.id);
      const movingDown =
        current.sprint_id === sprint_id &&
        current.order_index < target.order_index;
      order_index = movingDown
        ? (target.order_index +
            (list[index + 1]?.order_index ?? target.order_index + 200)) /
          2
        : ((list[index - 1]?.order_index ?? target.order_index - 200) +
            target.order_index) /
          2;
    }
    mutation.mutate({ id: current.id, patch: { sprint_id, order_index } });
  }
  return (
    <DndContext sensors={sensors} onDragEnd={end}>
      <div className="planning-grid">
        <Zone
          id="sprint"
          title={selected.name}
          items={sorted(eligible.filter((i) => i.sprint_id === selected.id))}
          sprints={sprints}
          move={move}
          disabled={disabled}
        />
        <Zone
          id="backlog"
          title="Backlog"
          items={sorted(eligible.filter((i) => !i.sprint_id))}
          sprints={sprints}
          move={move}
          disabled={disabled}
        />
      </div>
    </DndContext>
  );
}
