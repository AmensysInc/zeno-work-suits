'use client';

import Link from 'next/link';
import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CornerDownRight, GripVertical, MoreHorizontal, Plus } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { statuses, type Issue } from '@/types';
import { Avatar, Tag, projectColor } from '@/components/ui/display';
import { Menu } from '@/components/ui/controls';
import { IssueKey, Points, PriorityIcon, StatusIcon, TypeIcon, statusMeta } from '@/components/ui/glyphs';
import { useCreateIssue } from '@/components/layout/context';
import { cn } from '@/lib/utils';

const columns = statuses.slice(1);

function Card({ issue, subtasks, pending, onStatus }: { issue: Issue; subtasks?: [number, number]; pending: boolean; onStatus: (id: number, s: Issue['status']) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: issue.id, disabled: pending });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn('flex flex-col gap-2 rounded-[9px] border border-line bg-surface px-3 py-2.5 shadow-sm', isDragging && 'relative z-10 rotate-[-2deg] shadow-lg ring-1 ring-accent')}
    >
      <div className="flex items-center justify-between gap-2">
        <IssueKey>{issue.issue_key}</IssueKey>
        <div className="flex items-center gap-1">
          <Menu
            trigger={
              <button aria-label={`Status for ${issue.issue_key}`} className="rounded p-0.5 text-ink-3 hover:bg-hover hover:text-ink">
                <MoreHorizontal className="size-3.5" />
              </button>
            }
            items={columns.map((s) => ({ label: `Move to ${statusMeta[s].label}`, icon: <StatusIcon status={s} />, disabled: pending || s === issue.status, onSelect: () => onStatus(issue.id, s) }))}
          />
          <button {...attributes} {...listeners} aria-label={`Drag ${issue.issue_key}`} className="cursor-grab touch-none text-ink-4 hover:text-ink-2">
            <GripVertical className="size-3.5" />
          </button>
        </div>
      </div>
      <Link href={`/issues/${issue.id}`} className="text-[13px] font-medium leading-snug hover:text-accent-ink">
        {issue.summary}
      </Link>
      {issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {issue.labels.slice(0, 3).map((l) => (
            <Tag key={l} color={projectColor(l.length * 7)}>
              {l}
            </Tag>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <TypeIcon type={issue.issue_type} size={15} />
        <PriorityIcon priority={issue.priority} />
        {subtasks && subtasks[1] > 0 && (
          <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-3">
            <CornerDownRight className="size-3" />
            {subtasks[0]}/{subtasks[1]}
          </span>
        )}
        <span className="flex-1" />
        <Points value={issue.story_points} />
        <Avatar user={issue.assignee} size={20} />
      </div>
    </article>
  );
}

function Column({ status, issues, all, pending, onStatus, onAdd }: { status: Issue['status']; issues: Issue[]; all: Issue[]; pending: boolean; onStatus: (id: number, s: Issue['status']) => void; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: pending });
  return (
    <section ref={setNodeRef} className={cn('flex w-[272px] shrink-0 flex-col gap-2 lg:w-auto lg:min-w-0 lg:flex-1', isOver && 'rounded-xl bg-accent-soft/60 ring-2 ring-accent/40')}>
      <div className="flex h-[30px] items-center gap-2 px-1 text-[13px] font-semibold">
        <StatusIcon status={status} />
        {statusMeta[status].label}
        <span className="font-medium text-ink-3">{issues.length}</span>
        <span className="flex-1" />
        <button aria-label={`Add issue to ${statusMeta[status].label}`} onClick={onAdd} className="rounded p-0.5 text-ink-4 hover:bg-hover hover:text-ink">
          <Plus className="size-3.5" />
        </button>
      </div>
      {issues.map((i) => {
        const subs = all.filter((s) => s.parent_issue_id === i.id);
        return <Card key={i.id} issue={i} subtasks={[subs.filter((s) => s.status === 'DONE').length, subs.length]} pending={pending} onStatus={onStatus} />;
      })}
      {!issues.length && <p className="flex h-14 items-center justify-center rounded-[9px] border-[1.5px] border-dashed border-line-2 text-[12.5px] text-ink-3">Drop an issue here</p>}
    </section>
  );
}

export default function KanbanBoard({ projectId, issues, all = issues, sprintId }: { projectId: number; issues: Issue[]; all?: Issue[]; sprintId?: number }) {
  const qc = useQueryClient();
  const create = useCreateIssue();
  const key = [`/issues?project_id=${projectId}`];
  const mutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: Issue['status'] }) => (await api.patch(`/issues/${id}/status`, { status })).data,
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Issue[]>(key);
      qc.setQueryData<Issue[]>(key, (items) => items?.map((i) => (i.id === id ? { ...i, status } : i)));
      return { previous };
    },
    onError: (e, _, context) => {
      qc.setQueryData(key, context?.previous);
      toast.error(errorMessage(e));
    },
    onSettled: () => qc.invalidateQueries(),
  });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const onStatus = (id: number, status: Issue['status']) => mutation.mutate({ id, status });
  function end({ active, over }: DragEndEvent) {
    if (over && statuses.includes(over.id as Issue['status']) && !mutation.isPending) {
      const issue = issues.find((i) => i.id === Number(active.id));
      if (issue && issue.status !== over.id) onStatus(issue.id, over.id as Issue['status']);
    }
  }
  return (
    <DndContext sensors={sensors} onDragEnd={end}>
      <div className="scrollbar-thin flex min-h-full items-start gap-3 overflow-x-auto bg-subtle px-3 py-3.5 sm:px-4">
        {columns.map((s) => (
          <Column
            key={s}
            status={s}
            all={all}
            issues={issues.filter((i) => i.status === s || (s === 'TODO' && i.status === 'BACKLOG'))}
            pending={mutation.isPending}
            onStatus={onStatus}
            onAdd={() => create({ project_id: projectId, sprint_id: sprintId ?? null })}
          />
        ))}
      </div>
    </DndContext>
  );
}
