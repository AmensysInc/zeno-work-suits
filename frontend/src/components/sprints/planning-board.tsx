'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, GripVertical, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { Issue, Sprint } from '@/types';
import { useCanLead, useSave } from '@/hooks/data';
import { useMoveIssue } from '@/hooks/use-move-issue';
import { useCreateIssue } from '@/components/layout/context';
import { Avatar, Badge, Tag } from '@/components/ui/display';
import { Checkbox, Menu } from '@/components/ui/controls';
import { IssueKey, Points, PriorityIcon, StatusIcon, TypeIcon } from '@/components/ui/glyphs';
import { confirm } from '@/components/ui/confirm';
import { cn } from '@/lib/utils';

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
  card,
}: {
  issue: Issue;
  sprints: Sprint[];
  epic?: Issue;
  move: (id: number, sprint_id: number | null) => void;
  disabled: boolean;
  selection?: Selection;
  card: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id, disabled });
  const edit = useCreateIssue();
  const del = useSave(`/issues/${issue.id}`, 'delete', 'Issue deleted');
  const canLead = useCanLead(issue.project_id);
  const selected = selection?.ids.has(issue.id);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex items-center gap-2.5 bg-surface text-[13px]',
        card ? 'rounded-[9px] border border-line px-3 py-2 shadow-sm' : 'h-10 border-b border-line pl-2 pr-3 sm:pr-[18px]',
        selected && 'bg-sel',
        isDragging && 'relative z-10 rotate-[-1deg] shadow-lg ring-1 ring-accent',
      )}
    >
      <button {...attributes} {...listeners} aria-label={`Drag ${issue.issue_key}`} className="cursor-grab touch-none text-ink-4 hover:text-ink-2 disabled:cursor-default">
        <GripVertical className="size-3.5" />
      </button>
      {selection && <Checkbox aria-label={`Select ${issue.issue_key}`} checked={!!selected} onChange={() => selection.toggle(issue.id)} />}
      {!card && <PriorityIcon priority={issue.priority} />}
      {!card && <IssueKey className="hidden w-[68px] sm:inline">{issue.issue_key}</IssueKey>}
      <TypeIcon type={issue.issue_type} size={15} />
      <Link href={`/issues/${issue.id}`} className={cn('min-w-0 flex-1 hover:text-accent-ink', card ? 'flex flex-col' : 'truncate font-medium')}>
        {card ? (
          <>
            <span className="truncate text-[12.5px] font-medium">{issue.summary}</span>
            <IssueKey>{issue.issue_key}</IssueKey>
          </>
        ) : (
          issue.summary
        )}
      </Link>
      {epic && !card && (
        <span className="hidden md:inline">
          <Tag color="#7c3aed">{epic.summary}</Tag>
        </span>
      )}
      {!['BACKLOG', 'TODO'].includes(issue.status) && !card && (
        <span title={issue.status} className="hidden sm:inline">
          <StatusIcon status={issue.status} />
        </span>
      )}
      {card && <PriorityIcon priority={issue.priority} />}
      <Points value={issue.story_points} />
      <Avatar user={issue.assignee} size={20} />
      <Menu
        trigger={
          <button aria-label={`Actions for ${issue.issue_key}`} className="rounded p-0.5 text-ink-3 hover:bg-hover hover:text-ink">
            <MoreHorizontal className="size-4" />
          </button>
        }
        items={[
          { label: 'Edit', icon: <Pencil />, onSelect: () => edit(issue) },
          'separator',
          ...[null, ...sprints.filter((s) => s.status !== 'COMPLETED')].map((s) => ({
            label: `Move to ${s ? s.name : 'Backlog'}`,
            disabled: disabled || (s?.id ?? null) === issue.sprint_id,
            onSelect: () => move(issue.id, s?.id ?? null),
          })),
          ...(canLead
            ? [
                'separator' as const,
                {
                  label: 'Delete',
                  icon: <Trash2 />,
                  danger: true,
                  disabled: del.isPending,
                  onSelect: async () => {
                    if (await confirm(`Delete ${issue.issue_key}? Its subtasks, test cases and their run history are deleted too.`, { okText: 'Delete' })) del.mutate({});
                  },
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}

function Zone({
  id,
  title,
  badge,
  head,
  actions,
  items,
  sprints,
  epics,
  move,
  disabled,
  selection,
  card,
}: {
  id: string;
  title: ReactNode;
  badge?: ReactNode;
  head?: ReactNode;
  actions?: ReactNode;
  items: Issue[];
  sprints: Sprint[];
  epics: Issue[];
  move: (id: number, sprint: number | null) => void;
  disabled: boolean;
  selection?: Selection;
  card: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  const [open, setOpen] = useState(true);
  const points = items.reduce((n, i) => n + i.story_points, 0);
  if (card)
    return (
      <div
        ref={setNodeRef}
        className={cn('flex min-w-0 flex-1 flex-col gap-2 rounded-xl border border-line bg-subtle p-3', id !== 'backlog' && 'border-[#dcdffe] bg-[#f5f6ff] dark:border-accent/30 dark:bg-accent-soft/40', isOver && 'ring-2 ring-accent')}
      >
        <div className="flex items-center justify-between gap-2 px-1 pb-1">
          <span className="flex items-center gap-2 text-[13px] font-semibold">
            {title}
            <span className="font-medium text-ink-3">
              {items.length} · {points} pts
            </span>
          </span>
          {actions}
        </div>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((i) => (
            <Item key={i.id} card issue={i} sprints={sprints} epic={epics.find((e) => e.id === i.epic_id)} move={move} disabled={disabled} selection={selection} />
          ))}
        </SortableContext>
        <div className="flex h-12 items-center justify-center rounded-[9px] border-[1.5px] border-dashed border-line-2 text-[12.5px] text-ink-3">Drop issues here</div>
      </div>
    );
  return (
    <section ref={setNodeRef} className={cn(isOver && 'ring-2 ring-inset ring-accent')}>
      <div className="flex min-h-[52px] flex-wrap items-center gap-2.5 border-b border-line bg-subtle py-2 pl-2.5 pr-3 sm:pr-[18px]">
        <button onClick={() => setOpen(!open)} aria-label={open ? 'Collapse' : 'Expand'} className="text-ink-3">
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
        <span className="text-[13px] font-semibold">{title}</span>
        {badge}
        <div className="min-w-0 flex-1 text-xs text-ink-3">{head ?? `${items.length} issues · ${points} pts`}</div>
        {actions}
      </div>
      {open && (
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((i) => (
            <Item key={i.id} card={false} issue={i} sprints={sprints} epic={epics.find((e) => e.id === i.epic_id)} move={move} disabled={disabled} selection={selection} />
          ))}
          {!items.length && <div className="border-b border-line py-4 text-center text-[12.5px] text-ink-3">Drop issues here</div>}
        </SortableContext>
      )}
    </section>
  );
}

/**
 * Drag work between sprints and the backlog, and drag within a list to rank it.
 * `zones` are the sprints shown with the backlog; `layout="columns"` puts them side by side.
 */
export default function PlanningBoard({
  projectId,
  issues,
  sprints,
  zones,
  filter = () => true,
  backlogFilter = () => true,
  sprintHead,
  sprintActions,
  selection,
  layout = 'stack',
}: {
  projectId: number;
  issues: Issue[];
  sprints: Sprint[];
  zones: Sprint[];
  filter?: (i: Issue) => boolean;
  backlogFilter?: (i: Issue) => boolean;
  sprintHead?: (s: Sprint) => ReactNode;
  sprintActions?: (s: Sprint) => ReactNode;
  selection?: Selection;
  layout?: 'stack' | 'columns';
}) {
  const mutation = useMoveIssue(projectId);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const epics = issues.filter((i) => i.issue_type === 'EPIC');
  const eligible = issues.filter((i) => i.issue_type !== 'EPIC' && filter(i));
  const sorted = (items: Issue[]) => [...items].sort((a, b) => a.order_index - b.order_index || a.id - b.id);
  const inZone = (sprint_id: number | null) => sorted(eligible.filter((i) => i.sprint_id === sprint_id && (sprint_id || backlogFilter(i))));
  const move = (id: number, sprint_id: number | null) => mutation.mutate({ id, patch: { sprint_id } });
  const disabled = zones.some((s) => s.status === 'COMPLETED') || mutation.isPending;
  function end({ active, over }: DragEndEvent) {
    if (!over || disabled) return;
    const current = issues.find((i) => i.id === active.id);
    if (!current) return;
    const target = issues.find((i) => i.id === over.id);
    const sprint_id = target ? target.sprint_id : over.id === 'backlog' ? null : Number(String(over.id).replace('sprint-', ''));
    let order_index = Date.now();
    if (target && target.id !== current.id) {
      const list = inZone(sprint_id).filter((i) => i.id !== current.id);
      const index = list.findIndex((i) => i.id === target.id);
      const movingDown = current.sprint_id === sprint_id && current.order_index < target.order_index;
      order_index = movingDown
        ? (target.order_index + (list[index + 1]?.order_index ?? target.order_index + 200)) / 2
        : ((list[index - 1]?.order_index ?? target.order_index - 200) + target.order_index) / 2;
    }
    mutation.mutate({ id: current.id, patch: { sprint_id, order_index } });
  }
  const card = layout === 'columns';
  const backlog = <Zone id="backlog" card={card} title="Backlog" items={inZone(null)} sprints={sprints} epics={epics} move={move} disabled={disabled} selection={selection} />;
  return (
    <DndContext sensors={sensors} onDragEnd={end}>
      <div className={card ? 'flex flex-col gap-3.5 lg:flex-row lg:items-start' : ''}>
        {card && backlog}
        {zones.map((s) => (
          <Zone
            key={s.id}
            id={`sprint-${s.id}`}
            card={card}
            title={s.name}
            badge={<Badge value={s.status} />}
            head={sprintHead?.(s)}
            actions={sprintActions?.(s)}
            items={inZone(s.id)}
            sprints={sprints}
            epics={epics}
            move={move}
            disabled={disabled}
            selection={selection}
          />
        ))}
        {!card && backlog}
      </div>
    </DndContext>
  );
}
