import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Avatar, Tooltip, Typography } from 'antd';
import { HolderOutlined } from '@ant-design/icons';
import { toast } from 'sonner';
import { api, errorMessage } from '../../services/api';
import { type Issue, statuses, label } from '../../types';
import { Badge } from '../ui/shared';
import { Select, labelled } from '../ui/form';
function Card({
  issue,
  pending,
  onStatus,
}: {
  issue: Issue;
  pending: boolean;
  onStatus: (id: number, status: Issue['status']) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: issue.id, disabled: pending });
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
        <Link className="key" to={`/issues/${issue.id}`}>
          {issue.issue_key}
        </Link>
        <button
          className="drag-handle"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${issue.issue_key}`}
        >
          <HolderOutlined />
        </button>
      </div>
      <Link className="card-summary" to={`/issues/${issue.id}`}>
        {issue.summary}
      </Link>
      <div className="card-meta">
        <Badge value={issue.issue_type} />
        <Typography.Text
          type={issue.priority === 'CRITICAL' ? 'danger' : 'secondary'}
        >
          {label(issue.priority)}
        </Typography.Text>
      </div>
      <div className="card-meta">
        <span className="points">{issue.story_points} pts</span>
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
      <Select
        className="card-status"
        size="small"
        aria-label={`Status for ${issue.issue_key}`}
        value={issue.status}
        disabled={pending}
        onChange={(v) => onStatus(issue.id, v as Issue['status'])}
        options={labelled(statuses.slice(1))}
      />
    </article>
  );
}
function Column({
  status,
  issues,
  pending,
  onStatus,
}: {
  status: Issue['status'];
  issues: Issue[];
  pending: boolean;
  onStatus: (id: number, status: Issue['status']) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    disabled: pending,
  });
  return (
    <section
      ref={setNodeRef}
      className={`kanban-column ${isOver ? 'drop-over' : ''}`}
    >
      <div className="column-heading">
        <h3>{label(status)}</h3>
        <span>{issues.length}</span>
      </div>
      {issues.map((i) => (
        <Card key={i.id} issue={i} pending={pending} onStatus={onStatus} />
      ))}
      {!issues.length && <p className="column-empty">Drop an issue here</p>}
    </section>
  );
}
export default function KanbanBoard({
  projectId,
  issues,
}: {
  projectId: number;
  issues: Issue[];
}) {
  const qc = useQueryClient();
  const key = [`/issues?project_id=${projectId}`];
  const mutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: number;
      status: Issue['status'];
    }) => (await api.patch(`/issues/${id}/status`, { status })).data,
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Issue[]>(key);
      qc.setQueryData<Issue[]>(key, (items) =>
        items?.map((i) => (i.id === id ? { ...i, status } : i)),
      );
      return { previous };
    },
    onError: (e, _, context) => {
      qc.setQueryData(key, context?.previous);
      toast.error(errorMessage(e));
    },
    onSettled: () => qc.invalidateQueries(),
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const onStatus = (id: number, status: Issue['status']) =>
    mutation.mutate({ id, status });
  function end({ active, over }: DragEndEvent) {
    if (
      over &&
      statuses.includes(over.id as Issue['status']) &&
      !mutation.isPending
    )
      onStatus(Number(active.id), over.id as Issue['status']);
  }
  return (
    <DndContext sensors={sensors} onDragEnd={end}>
      <div className="kanban">
        {statuses.slice(1).map((s) => (
          <Column
            key={s}
            status={s}
            issues={issues.filter(
              (i) => i.status === s || (s === 'TODO' && i.status === 'BACKLOG'),
            )}
            pending={mutation.isPending}
            onStatus={onStatus}
          />
        ))}
      </div>
    </DndContext>
  );
}
