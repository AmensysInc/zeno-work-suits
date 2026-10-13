import type { ChangeEvent } from 'react';
import { useSave } from '../../hooks/data';
import {
  label,
  priorities,
  statuses,
  type Issue,
  type Sprint,
  type User,
} from '../../types';
import { Button } from '../ui/button';

/** Applies one change to every selected work item in a single request. */
export default function BulkActions({
  ids,
  members,
  sprints,
  onDone,
}: {
  ids: number[];
  members: User[];
  sprints: Sprint[];
  onDone: () => void;
}) {
  const save = useSave(
    '/issues/bulk',
    'patch',
    `${ids.length} item${ids.length === 1 ? '' : 's'} updated`,
  );
  if (!ids.length) return null;
  const apply = async (changes: Partial<Issue>) => {
    try {
      await save.mutateAsync({ ids, changes });
      onDone();
    } catch {
      /* toast */
    }
  };
  const pick =
    (field: keyof Issue, numeric = false) =>
    (e: ChangeEvent<HTMLSelectElement>) => {
      const v = e.target.value;
      e.target.value = '';
      if (!v) return;
      apply({
        [field]: v === 'none' ? null : numeric ? Number(v) : v,
      } as Partial<Issue>);
    };
  return (
    <div className="bulk-bar" role="region" aria-label="Bulk actions">
      <strong>{ids.length} selected</strong>
      <select
        aria-label="Move selected to sprint"
        defaultValue=""
        disabled={save.isPending}
        onChange={pick('sprint_id', true)}
      >
        <option value="">Move to…</option>
        <option value="none">Backlog</option>
        {sprints
          .filter((s) => s.status !== 'COMPLETED')
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
      </select>
      <select
        aria-label="Assign selected"
        defaultValue=""
        disabled={save.isPending}
        onChange={pick('assignee_id', true)}
      >
        <option value="">Assign to…</option>
        <option value="none">Unassigned</option>
        {members.map((u) => (
          <option key={u.id} value={u.id}>
            {u.first_name} {u.last_name}
          </option>
        ))}
      </select>
      <select
        aria-label="Set priority of selected"
        defaultValue=""
        disabled={save.isPending}
        onChange={pick('priority')}
      >
        <option value="">Priority…</option>
        {priorities.map((p) => (
          <option key={p} value={p}>
            {label(p)}
          </option>
        ))}
      </select>
      <select
        aria-label="Set status of selected"
        defaultValue=""
        disabled={save.isPending}
        onChange={pick('status')}
      >
        <option value="">Status…</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {label(s)}
          </option>
        ))}
      </select>
      <Button variant="ghost" onClick={onDone}>
        Clear selection
      </Button>
    </div>
  );
}
