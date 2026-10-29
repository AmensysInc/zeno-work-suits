import type { ReactNode } from 'react';
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
import { Avatar, Card, Checkbox, Tag, Tooltip, Typography } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  HolderOutlined,
} from '@ant-design/icons';
import { label, type Issue, type Sprint } from '../../types';
import { Badge } from '../ui/shared';
import { Button } from '../ui/button';
import { Select } from '../ui/form';
import { confirm } from '../ui/confirm';
import { useMoveIssue } from '../../hooks/useMoveIssue';
import { useCanLead, useSave } from '../../hooks/data';
import { useCreateIssue } from '../layout/AppShell';

export interface Selection {
  ids: Set<number>;
  toggle: (id: number) => void;
}

function Item({
  issue,
  sprints,
  epic,
  move,
  disabled,
  selection,
}: {
  issue: Issue;
  sprints: Sprint[];
  epic?: Issue;
  move: (id: number, sprint_id: number | null) => void;
  disabled: boolean;
  selection?: Selection;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: issue.id, disabled });
  const edit = useCreateIssue();
  const del = useSave(`/issues/${issue.id}`, 'delete', 'Issue deleted');
  const canLead = useCanLead(issue.project_id);
  return (
    <div
      className="planning-item"
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="actions">
        {selection && (
          <Checkbox
            aria-label={`Select ${issue.issue_key}`}
            checked={selection.ids.has(issue.id)}
            onChange={() => selection.toggle(issue.id)}
          />
        )}
        <button
          className="drag-handle"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${issue.issue_key}`}
        >
          <HolderOutlined />
        </button>
      </div>
      <div>
        <Link to={`/issues/${issue.id}`}>
          <span className="key">{issue.issue_key}</span>
          <strong>{issue.summary}</strong>
        </Link>
        <div className="actions">
          <Badge value={issue.issue_type} />
          {!['BACKLOG', 'TODO'].includes(issue.status) && (
            <Badge value={issue.status} />
          )}
          <Typography.Text
            type={issue.priority === 'CRITICAL' ? 'danger' : 'secondary'}
          >
            {label(issue.priority)}
          </Typography.Text>
          <Typography.Text type="secondary">
            {issue.story_points} pts
          </Typography.Text>
          {epic && (
            <Tag color="purple" variant="filled" className="chip-epic">
              {epic.summary}
            </Tag>
          )}
          <Tooltip
            title={
              issue.assignee
                ? `${issue.assignee.first_name} ${issue.assignee.last_name}`
                : 'Unassigned'
            }
          >
            <Avatar size={24} className="mini-avatar">
              {issue.assignee
                ? issue.assignee.first_name[0] + issue.assignee.last_name[0]
                : '—'}
            </Avatar>
          </Tooltip>
        </div>
      </div>
      <div className="actions">
        <Select
          size="small"
          aria-label={`Sprint for ${issue.issue_key}`}
          disabled={disabled}
          value={issue.sprint_id ?? ''}
          onChange={(v) => move(issue.id, v ? Number(v) : null)}
          options={[
            { value: '', label: 'Backlog' },
            ...sprints
              .filter((s) => s.status !== 'COMPLETED')
              .map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
        <Button
          variant="ghost"
          size="small"
          icon={<EditOutlined />}
          aria-label={`Edit ${issue.issue_key}`}
          title="Edit"
          onClick={() => edit(issue)}
        />
        {canLead && (
          <Button
            variant="ghost"
            size="small"
            icon={<DeleteOutlined />}
            aria-label={`Delete ${issue.issue_key}`}
            title="Delete"
            disabled={del.isPending}
            onClick={async () => {
              if (
                await confirm(
                  `Delete ${issue.issue_key}? Its subtasks, test cases and their run history are deleted too.`,
                  { okText: 'Delete' },
                )
              )
                del.mutate({});
            }}
          />
        )}
      </div>
    </div>
  );
}

function Zone({
  id,
  title,
  head,
  items,
  sprints,
  epics,
  move,
  disabled,
  selection,
}: {
  id: string;
  title: ReactNode;
  head?: ReactNode;
  items: Issue[];
  sprints: Sprint[];
  epics: Issue[];
  move: (id: number, sprint: number | null) => void;
  disabled: boolean;
  selection?: Selection;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  return (
    <div ref={setNodeRef}>
      <Card
        className={`card planning-zone ${isOver ? 'drop-over' : ''}`}
        title={title}
        extra={
          <Typography.Text type="secondary">
            {items.length} issues ·{' '}
            {items.reduce((n, i) => n + i.story_points, 0)} pts
          </Typography.Text>
        }
      >
        {head}
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((i) => (
            <Item
              key={i.id}
              issue={i}
              sprints={sprints}
              epic={epics.find((e) => e.id === i.epic_id)}
              move={move}
              disabled={disabled}
              selection={selection}
            />
          ))}
        </SortableContext>
        {!items.length && <div className="empty">Drop issues here</div>}
      </Card>
    </div>
  );
}

/**
 * Drag work between sprints and the backlog, and drag within a list to rank it.
 * `zones` are the sprints shown above the backlog.
 */
export default function PlanningBoard({
  projectId,
  issues,
  sprints,
  zones,
  filter = () => true,
  backlogFilter = () => true,
  sprintHead,
  selection,
  layout = 'grid',
}: {
  projectId: number;
  issues: Issue[];
  sprints: Sprint[];
  zones: Sprint[];
  filter?: (i: Issue) => boolean;
  backlogFilter?: (i: Issue) => boolean;
  sprintHead?: (s: Sprint) => ReactNode;
  selection?: Selection;
  layout?: 'grid' | 'stack';
}) {
  const mutation = useMoveIssue(projectId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const epics = issues.filter((i) => i.issue_type === 'EPIC');
  const eligible = issues.filter((i) => i.issue_type !== 'EPIC' && filter(i));
  const sorted = (items: Issue[]) =>
    [...items].sort((a, b) => a.order_index - b.order_index || a.id - b.id);
  const inZone = (sprint_id: number | null) =>
    sorted(
      eligible.filter(
        (i) => i.sprint_id === sprint_id && (sprint_id || backlogFilter(i)),
      ),
    );
  const move = (id: number, sprint_id: number | null) =>
    mutation.mutate({ id, patch: { sprint_id } });
  const disabled =
    zones.some((s) => s.status === 'COMPLETED') || mutation.isPending;
  function end({ active, over }: DragEndEvent) {
    if (!over || disabled) return;
    const current = issues.find((i) => i.id === active.id);
    if (!current) return;
    const target = issues.find((i) => i.id === over.id);
    const sprint_id = target
      ? target.sprint_id
      : over.id === 'backlog'
        ? null
        : Number(String(over.id).replace('sprint-', ''));
    let order_index = Date.now();
    if (target && target.id !== current.id) {
      const list = inZone(sprint_id).filter((i) => i.id !== current.id);
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
      <div className={layout === 'grid' ? 'planning-grid' : 'planning-stack'}>
        {zones.map((s) => (
          <Zone
            key={s.id}
            id={`sprint-${s.id}`}
            title={
              <>
                {s.name} <Badge value={s.status} />
              </>
            }
            head={sprintHead?.(s)}
            items={inZone(s.id)}
            sprints={sprints}
            epics={epics}
            move={move}
            disabled={disabled}
            selection={selection}
          />
        ))}
        <Zone
          id="backlog"
          title="Backlog"
          items={inZone(null)}
          sprints={sprints}
          epics={epics}
          move={move}
          disabled={disabled}
          selection={selection}
        />
      </div>
    </DndContext>
  );
}
