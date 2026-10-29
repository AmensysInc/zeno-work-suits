import { useState } from 'react';
import { Input } from 'antd';
import { Button } from '../ui/button';
import { Select } from '../ui/form';
import {
  issueTypes,
  label,
  priorities,
  statuses,
  type Issue,
  type Sprint,
  type User,
} from '../../types';

export interface Filters {
  search: string;
  type: string;
  status: string;
  priority: string;
  assignee: string;
  epic: string;
  sprint: string;
}
type Field = Exclude<keyof Filters, 'search'>;

const empty: Filters = {
  search: '',
  type: '',
  status: '',
  priority: '',
  assignee: '',
  epic: '',
  sprint: '',
};

export function useFilters() {
  const [filters, setFilters] = useState(empty);
  const matches = (i: Issue) =>
    (!filters.search ||
      `${i.issue_key} ${i.summary} ${i.labels.join(' ')}`
        .toLowerCase()
        .includes(filters.search.toLowerCase())) &&
    (!filters.type || i.issue_type === filters.type) &&
    (!filters.status || i.status === filters.status) &&
    (!filters.priority || i.priority === filters.priority) &&
    (!filters.assignee ||
      String(i.assignee_id ?? 'none') === filters.assignee) &&
    (!filters.epic ||
      String(i.epic_id ?? 'none') === filters.epic ||
      String(i.id) === filters.epic) &&
    (!filters.sprint || String(i.sprint_id ?? 'none') === filters.sprint);
  const active = Object.values(filters).some(Boolean);
  return {
    filters,
    set: (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch })),
    reset: () => setFilters(empty),
    matches,
    active,
  };
}

/** Search and dropdown filters; pass only the fields a page needs. */
export default function WorkItemFilters({
  state,
  fields,
  members = [],
  epics = [],
  sprints = [],
}: {
  state: ReturnType<typeof useFilters>;
  fields: Field[];
  members?: User[];
  epics?: Issue[];
  sprints?: Sprint[];
}) {
  const { filters, set, reset, active } = state;
  const options: Record<Field, [string, [string, string][]]> = {
    type: ['All types', issueTypes.map((t) => [t, label(t)])],
    status: ['All statuses', statuses.map((s) => [s, label(s)])],
    priority: ['All priorities', priorities.map((p) => [p, label(p)])],
    assignee: [
      'All assignees',
      [
        ...members.map(
          (u) =>
            [String(u.id), `${u.first_name} ${u.last_name}`] as [
              string,
              string,
            ],
        ),
        ['none', 'Unassigned'],
      ],
    ],
    epic: [
      'All epics',
      [
        ...epics.map((e) => [String(e.id), e.summary] as [string, string]),
        ['none', 'No epic'],
      ],
    ],
    sprint: [
      'All sprints',
      [
        ...sprints.map((s) => [String(s.id), s.name] as [string, string]),
        ['none', 'Backlog'],
      ],
    ],
  };
  return (
    <div className="filters" role="search">
      <Input.Search
        allowClear
        aria-label="Search work items"
        placeholder="Search key, summary or label…"
        value={filters.search}
        onChange={(e) => set({ search: e.target.value })}
      />
      {fields.map((field) => {
        const [all, values] = options[field];
        return (
          <Select
            key={field}
            aria-label={`Filter by ${field}`}
            value={filters[field]}
            onChange={(v) => set({ [field]: v })}
            options={[
              { value: '', label: all },
              ...values.map(([value, text]) => ({ value, label: text })),
            ]}
          />
        );
      })}
      {active && (
        <Button variant="ghost" onClick={reset}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
