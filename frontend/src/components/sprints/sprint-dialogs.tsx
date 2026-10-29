'use client';

import { useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { useSave } from '@/hooks/data';
import type { Issue, Sprint } from '@/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Note } from '@/components/ui/display';
import { cn } from '@/lib/utils';

/** Create, edit or start a sprint. */
export function SprintDialog({
  projectId,
  sprint,
  start = false,
  issues = [],
  onClose,
}: {
  projectId: number;
  sprint?: Sprint;
  start?: boolean;
  issues?: Issue[];
  onClose: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [capacity, setCapacity] = useState(sprint?.capacity ?? 30);
  const save = useSave(sprint ? `/sprints/${sprint.id}` : `/projects/${projectId}/sprints`, sprint ? 'put' : 'post', start ? '' : 'Sprint saved');
  const begin = useSave(`/sprints/${sprint?.id}/start`, 'post', 'Sprint started');
  const points = issues.reduce((n, i) => n + i.story_points, 0);
  const submit = async () => {
    if (!form.current?.reportValidity()) return;
    const f = new FormData(form.current);
    try {
      await save.mutateAsync({
        name: f.get('name'),
        goal: f.get('goal'),
        start_date: f.get('start_date') || null,
        end_date: f.get('end_date') || null,
        capacity: Number(f.get('capacity')),
      });
      if (start) await begin.mutateAsync({});
      onClose();
    } catch {
      /* toast */
    }
  };
  return (
    <Dialog
      title={start ? `Start ${sprint?.name ?? 'sprint'}` : sprint ? 'Edit sprint' : 'Create sprint'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={start ? <Play /> : undefined} loading={save.isPending || begin.isPending} onClick={submit}>
            {start ? 'Start sprint' : 'Save sprint'}
          </Button>
        </>
      }
    >
      <form
        ref={form}
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Sprint name">{(id) => <Input id={id} size="lg" name="name" required defaultValue={sprint?.name} autoFocus />}</Field>
        <Field label="Sprint goal">{(id) => <Textarea id={id} name="goal" rows={2} defaultValue={sprint?.goal} />}</Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_120px]">
          <Field label="Start date">{(id) => <Input id={id} type="date" name="start_date" required={start} defaultValue={sprint?.start_date ?? ''} />}</Field>
          <Field label="End date">{(id) => <Input id={id} type="date" name="end_date" required={start} defaultValue={sprint?.end_date ?? ''} />}</Field>
          <Field label="Capacity · pts">
            {(id) => <Input id={id} type="number" name="capacity" min={1} required value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />}
          </Field>
        </div>
        {start && (
          <>
            {points > capacity && (
              <Note tone="amber">
                <b>
                  {points} points planned for {capacity} of capacity.
                </b>{' '}
                You can still start; consider moving {points - capacity} points back to the backlog.
              </Note>
            )}
            <Note>
              {issues.length} issues · {points} story points. Starting moves this sprint’s Backlog items to To do. Only one sprint can be active.
            </Note>
          </>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/** Completes a sprint, sending unfinished work to the backlog or a planned sprint. */
export function CompleteSprintDialog({ sprint, sprints, issues, onClose }: { sprint: Sprint; sprints: Sprint[]; issues: Issue[]; onClose: () => void }) {
  const [target, setTarget] = useState<number | null>(null);
  const complete = useSave(`/sprints/${sprint.id}/complete`, 'post', 'Sprint completed');
  const items = issues.filter((i) => i.sprint_id === sprint.id);
  const done = items.filter((i) => i.status === 'DONE');
  const open = items.filter((i) => i.status !== 'DONE');
  const planned = sprints.filter((s) => s.status === 'PLANNED');
  const submit = async () => {
    try {
      await complete.mutateAsync({ move_to_sprint_id: target });
      onClose();
    } catch {
      /* toast */
    }
  };
  const choices: { id: number | null; name: string; detail: string }[] = [
    ...planned.map((s) => ({ id: s.id, name: s.name, detail: `Planned${s.start_date ? ` · ${s.start_date} — ${s.end_date ?? '…'}` : ''}` })),
    { id: null, name: 'Backlog', detail: 'Unfinished items return to the backlog' },
  ];
  return (
    <Dialog
      title={`Complete ${sprint.name}`}
      width={480}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={complete.isPending} onClick={submit}>
            Complete sprint
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2.5">
          {(
            [
              ['Done', done, '#16a34a'],
              ['Not done', open, '#d97706'],
            ] as const
          ).map(([name, list, color]) => (
            <div key={name} className="rounded-lg border border-line px-3.5 py-3">
              <span className="text-xs text-ink-3">{name}</span>
              <div className="flex items-baseline gap-2">
                <span className="tnum text-[24px] font-semibold" style={{ color }}>
                  {list.length}
                </span>
                <span className="text-[12.5px] text-ink-2">issues · {list.reduce((n, i) => n + i.story_points, 0)} pts</span>
              </div>
            </div>
          ))}
        </div>
        {open.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium">Move unfinished work to</span>
            <div role="radiogroup" className="rounded-lg border border-line p-1">
              {choices.map((c) => (
                <button
                  key={c.id ?? 'backlog'}
                  role="radio"
                  aria-checked={target === c.id}
                  onClick={() => setTarget(c.id)}
                  className={cn('flex w-full items-center gap-2.5 rounded-md p-2.5 text-left', target === c.id && 'bg-accent-soft')}
                >
                  <span className={cn('size-[15px] shrink-0 rounded-full border-[1.5px] border-line-2', target === c.id && 'border-[4.5px] border-accent')} />
                  <span className="flex flex-col">
                    <span className="text-[13px] font-semibold">{c.name}</span>
                    <span className="text-xs text-ink-3">{c.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
