'use client';

import type { ReactNode } from 'react';
import { ChevronDown, Timer, User as UserIcon } from 'lucide-react';
import { useSave } from '@/hooks/data';
import { label, priorities, statuses, type Issue, type Sprint, type User } from '@/types';
import { Checkbox, Menu } from '@/components/ui/controls';
import { Button } from '@/components/ui/button';
import { PriorityIcon, StatusIcon } from '@/components/ui/glyphs';
import { Avatar } from '@/components/ui/display';

/** Applies one change to every selected work item in a single request. */
export default function BulkActions({ ids, members, sprints, onDone }: { ids: number[]; members: User[]; sprints: Sprint[]; onDone: () => void }) {
  const save = useSave('/issues/bulk', 'patch', `${ids.length} item${ids.length === 1 ? '' : 's'} updated`);
  if (!ids.length) return null;
  const apply = async (changes: Partial<Issue>) => {
    try {
      await save.mutateAsync({ ids, changes });
      onDone();
    } catch {
      /* toast */
    }
  };
  // Each menu is an action, not a setting: it never keeps a value.
  const action = (name: string, icon: ReactNode, items: { label: string; icon?: ReactNode; changes: Partial<Issue> }[]) => (
    <Menu
      align="start"
      trigger={
        <Button size="sm" disabled={save.isPending} aria-label={name}>
          {icon}
          {name.replace(' selected', '')}
          <ChevronDown />
        </Button>
      }
      items={items.map((i) => ({ label: i.label, icon: i.icon, onSelect: () => apply(i.changes) }))}
    />
  );
  return (
    <div role="region" aria-label="Bulk actions" className="flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b border-[#dcdffe] bg-accent-soft px-3 py-1.5 sm:px-[18px] dark:border-accent/30">
      <Checkbox checked onChange={onDone} aria-label="Clear selection" />
      <span className="text-[12.5px] font-semibold">{ids.length} selected</span>
      <span className="mx-1 h-[18px] w-px bg-[#c7cbfb] dark:bg-accent/40" />
      {sprints.length > 0 &&
        action('Move selected to sprint', <Timer />, [
          { label: 'Backlog', changes: { sprint_id: null } },
          ...sprints.filter((s) => s.status !== 'COMPLETED').map((s) => ({ label: s.name, changes: { sprint_id: s.id } })),
        ])}
      {action('Set status of selected', <StatusIcon status="TODO" size={12} />, statuses.map((s) => ({ label: label(s), icon: <StatusIcon status={s} />, changes: { status: s } })))}
      {action('Set priority of selected', <PriorityIcon priority="HIGH" size={12} />, priorities.map((p) => ({ label: label(p), icon: <PriorityIcon priority={p} />, changes: { priority: p } })))}
      {action('Assign selected', <UserIcon />, [
        { label: 'Unassigned', changes: { assignee_id: null } },
        ...members.map((u) => ({ label: `${u.first_name} ${u.last_name}`, icon: <Avatar user={u} size={16} />, changes: { assignee_id: u.id } })),
      ])}
      <div className="flex-1" />
      <Button size="sm" variant="ghost" onClick={onDone}>
        Clear
      </Button>
    </div>
  );
}
