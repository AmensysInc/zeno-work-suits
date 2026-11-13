'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { User } from '@/types';
import { Avatar } from '@/components/ui/display';
import { Checkbox, Popover } from '@/components/ui/controls';
import { cn } from '@/lib/utils';

const fullName = (u: User) => `${u.first_name} ${u.last_name}`.trim();

/** Multi-select people picker with checkboxes (create/edit issue assignee). */
export default function AssigneePicker({
  members: people_,
  value,
  onChange,
  meId,
  'aria-label': ariaLabel = 'Assignees',
}: {
  members: User[];
  value: number[];
  /** The signed-in user: listed first and marked "(you)". */
  meId?: number;
  onChange: (ids: number[]) => void;
  'aria-label'?: string;
}) {
  const [open, setOpen] = useState(false);
  const members = useMemo(
    () => [...people_].sort((a, b) => Number(b.id === meId) - Number(a.id === meId)),
    [people_, meId],
  );
  const selected = useMemo(() => new Set(value), [value]);
  const people = useMemo(() => members.filter((u) => selected.has(u.id)), [members, selected]);
  const toggle = (id: number) => {
    if (selected.has(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  };
  const label =
    people.length === 0
      ? 'Unassigned'
      : people.length === 1
        ? fullName(people[0])
        : `${people.length} people`;
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="w-[260px] p-1"
      trigger={
        <button
          type="button"
          aria-label={ariaLabel}
          aria-expanded={open}
          className="flex h-8 w-full items-center gap-2 rounded-md border border-line-2 bg-surface px-2.5 text-left text-[13px] text-ink outline-none hover:border-line-2 focus:border-accent focus:shadow-[0_0_0_3px_var(--ring)]"
        >
          {people.length === 0 ? (
            <Avatar user={null} size={16} />
          ) : people.length === 1 ? (
            <Avatar user={people[0]} size={16} />
          ) : (
            <span className="inline-flex">
              {people.slice(0, 2).map((u, i) => (
                <span key={u.id} className={cn('rounded-full ring-2 ring-surface', i && '-ml-1')}>
                  <Avatar user={u} size={16} />
                </span>
              ))}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <ChevronDown className="size-3.5 shrink-0 text-ink-3" />
        </button>
      }
    >
      <div className="scrollbar-thin max-h-64 overflow-y-auto">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hover"
          onClick={() => onChange([])}
        >
          <Avatar user={null} size={18} />
          <span className="flex-1">Unassigned</span>
          {value.length === 0 && <Check className="size-3.5 text-accent" />}
        </button>
        {members.map((u) => {
          const on = selected.has(u.id);
          return (
            <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-hover">
              <Checkbox checked={on} onChange={() => toggle(u.id)} aria-label={fullName(u)} />
              <Avatar user={u} size={18} />
              <span className="min-w-0 flex-1 truncate">
                {fullName(u)}
                {u.id === meId && <span className="text-ink-3"> (you)</span>}
              </span>
            </label>
          );
        })}
      </div>
    </Popover>
  );
}
