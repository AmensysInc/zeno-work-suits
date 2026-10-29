'use client';

import { useState, type ReactNode } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { issueTypes, label, priorities, statuses, type Issue, type Sprint, type User } from '@/types';
import { Input } from '@/components/ui/input';
import { Popover } from '@/components/ui/controls';
import { PriorityIcon, StatusIcon, TypeIcon } from '@/components/ui/glyphs';
import { Avatar } from '@/components/ui/display';
import { cn } from '@/lib/utils';

export interface Filters {
  search: string;
  type: string;
  status: string;
  priority: string;
  assignee: string;
  epic: string;
  sprint: string;
}
export type FilterField = Exclude<keyof Filters, 'search'>;
const empty: Filters = { search: '', type: '', status: '', priority: '', assignee: '', epic: '', sprint: '' };

export function useFilters() {
  const [filters, setFilters] = useState(empty);
  const matches = (i: Issue) =>
    (!filters.search || `${i.issue_key} ${i.summary} ${i.labels.join(' ')}`.toLowerCase().includes(filters.search.toLowerCase())) &&
    (!filters.type || i.issue_type === filters.type) &&
    (!filters.status || i.status === filters.status) &&
    (!filters.priority || i.priority === filters.priority) &&
    (!filters.assignee || String(i.assignee_id ?? 'none') === filters.assignee) &&
    (!filters.epic || String(i.epic_id ?? 'none') === filters.epic || String(i.id) === filters.epic) &&
    (!filters.sprint || String(i.sprint_id ?? 'none') === filters.sprint);
  const active = Object.values(filters).some(Boolean);
  return { filters, set: (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch })), reset: () => setFilters(empty), matches, active };
}

type Choice = { value: string; label: string; icon?: ReactNode };

/** A dashed "+ Field" chip that becomes "Field: value ×" once set. */
export function FilterChip({ name, value, choices, onChange }: { name: string; value: string; choices: Choice[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = choices.find((c) => c.value === value);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="w-56"
      trigger={
        <button
          aria-label={`Filter by ${name.toLowerCase()}`}
          className={cn(
            'inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-[12.5px] font-medium [&_svg]:size-3',
            current ? 'border-line-2 bg-subtle text-ink' : 'border-dashed border-line-2 text-ink-2 hover:bg-hover',
          )}
        >
          {current ? (
            <>
              {name}: <b className="max-w-40 truncate font-semibold">{current.label}</b>
              <span
                role="button"
                aria-label={`Clear ${name.toLowerCase()} filter`}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange('');
                }}
                className="text-ink-3 hover:text-ink"
              >
                <X />
              </span>
            </>
          ) : (
            <>
              <Plus />
              {name}
            </>
          )}
        </button>
      }
    >
      <div className="scrollbar-thin max-h-72 overflow-y-auto">
        {choices.map((c) => (
          <button
            key={c.value}
            onClick={() => {
              onChange(c.value === value ? '' : c.value);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hover"
          >
            {c.icon}
            <span className="flex-1 truncate">{c.label}</span>
            {c.value === value && <Check className="size-3.5 text-accent" />}
          </button>
        ))}
      </div>
    </Popover>
  );
}

/** Search box and filter chips; pass only the fields a page needs. */
export default function WorkItemFilters({
  state,
  fields,
  members = [],
  epics = [],
  sprints = [],
  children,
}: {
  state: ReturnType<typeof useFilters>;
  fields: FilterField[];
  members?: User[];
  epics?: Issue[];
  sprints?: Sprint[];
  children?: ReactNode;
}) {
  const { filters, set, reset, active } = state;
  const choices: Record<FilterField, [string, Choice[]]> = {
    type: ['Type', issueTypes.map((t) => ({ value: t, label: label(t), icon: <TypeIcon type={t} size={14} /> }))],
    status: ['Status', statuses.map((s) => ({ value: s, label: label(s), icon: <StatusIcon status={s} /> }))],
    priority: ['Priority', priorities.map((p) => ({ value: p, label: label(p), icon: <PriorityIcon priority={p} /> }))],
    assignee: [
      'Assignee',
      [...members.map((u) => ({ value: String(u.id), label: `${u.first_name} ${u.last_name}`, icon: <Avatar user={u} size={16} /> })), { value: 'none', label: 'Unassigned', icon: <Avatar user={null} size={16} /> }],
    ],
    epic: ['Epic', [...epics.map((e) => ({ value: String(e.id), label: e.summary, icon: <TypeIcon type="EPIC" size={14} /> })), { value: 'none', label: 'No epic' }]],
    sprint: ['Sprint', [...sprints.map((s) => ({ value: String(s.id), label: s.name })), { value: 'none', label: 'Backlog' }]],
  };
  return (
    <div role="search" className="flex min-h-11 shrink-0 flex-wrap items-center gap-1.5 border-b border-line px-3 py-1.5 sm:px-[18px]">
      <Input
        size="sm"
        className="w-full sm:w-[230px]"
        icon={<Search />}
        aria-label="Search work items"
        placeholder="Search key, summary or label…"
        value={filters.search}
        onChange={(e) => set({ search: e.target.value })}
      />
      {fields.map((f) => (
        <FilterChip key={f} name={choices[f][0]} value={filters[f]} choices={choices[f][1]} onChange={(v) => set({ [f]: v })} />
      ))}
      {active && (
        <button onClick={reset} className="px-1.5 text-[12.5px] text-ink-3 hover:text-ink">
          Clear
        </button>
      )}
      <div className="flex-1" />
      {children}
    </div>
  );
}
