import { Select, Typography } from 'antd';
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
  // Each picker is an action, not a setting: it never keeps a value.
  const pick =
    (field: keyof Issue, numeric = false) =>
    (v: string) =>
      apply({
        [field]: v === 'none' ? null : numeric ? Number(v) : v,
      } as Partial<Issue>);
  const picker = (
    name: string,
    placeholder: string,
    onChange: (v: string) => void,
    options: { value: string; label: string }[],
  ) => (
    <Select
      aria-label={name}
      placeholder={placeholder}
      value={null}
      disabled={save.isPending}
      onChange={onChange}
      options={options}
      popupMatchSelectWidth={false}
    />
  );
  return (
    <div className="bulk-bar" role="region" aria-label="Bulk actions">
      <Typography.Text strong>{ids.length} selected</Typography.Text>
      {picker('Move selected to sprint', 'Move to…', pick('sprint_id', true), [
        { value: 'none', label: 'Backlog' },
        ...sprints
          .filter((s) => s.status !== 'COMPLETED')
          .map((s) => ({ value: String(s.id), label: s.name })),
      ])}
      {picker('Assign selected', 'Assign to…', pick('assignee_id', true), [
        { value: 'none', label: 'Unassigned' },
        ...members.map((u) => ({
          value: String(u.id),
          label: `${u.first_name} ${u.last_name}`,
        })),
      ])}
      {picker(
        'Set priority of selected',
        'Priority…',
        pick('priority'),
        priorities.map((p) => ({ value: p, label: label(p) })),
      )}
      {picker(
        'Set status of selected',
        'Status…',
        pick('status'),
        statuses.map((s) => ({ value: s, label: label(s) })),
      )}
      <Button variant="ghost" onClick={onDone}>
        Clear selection
      </Button>
    </div>
  );
}
