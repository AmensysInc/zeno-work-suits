'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useIssues } from '@/hooks/data';
import { label, statuses, type Issue } from '@/types';
import { fullName, percent } from '@/lib/qa';
import { PageBar, PageBody } from '@/components/layout/page';
import { useCreateIssue } from '@/components/layout/context';
import { Badge, Card, State } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/controls';
import { IssueKey, TypeIcon, statusMeta } from '@/components/ui/glyphs';
import { StackedBar } from '@/components/charts';
import IssueList from '@/components/issues/issue-list';

function EpicCard({ epic, items }: { epic: Issue; items: Issue[] }) {
  const create = useCreateIssue();
  const [open, setOpen] = useState(false);
  const done = items.filter((i) => i.status === 'DONE');
  const points = items.reduce((n, i) => n + i.story_points, 0);
  const donePoints = done.reduce((n, i) => n + i.story_points, 0);
  const pct = percent(done.length, items.length);
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 px-4 py-3.5 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3 lg:w-[340px]">
          <button aria-label={open ? 'Hide items' : 'Show items'} onClick={() => setOpen(!open)} className="text-ink-3 hover:text-ink">
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          <TypeIcon type="EPIC" size={22} />
          <div className="flex min-w-0 flex-col">
            <Link href={`/issues/${epic.id}`} className="truncate text-[14px] font-semibold hover:text-accent-ink">
              {epic.summary}
            </Link>
            <span className="truncate text-[11.5px] text-ink-3">
              <IssueKey>{epic.issue_key}</IssueKey> · {label(epic.priority)} priority · {fullName(epic.assignee)}
              {epic.due_date && ` · due ${epic.due_date}`}
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <StackedBar height={8} parts={statuses.map((s) => ({ label: statusMeta[s].label, value: items.filter((i) => i.status === s).length, color: statusMeta[s].color }))} />
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-ink-3">
            {done.length}/{items.length} items · {donePoints}/{points} pts
          </span>
          <b className="tnum w-11 text-right text-[14px] font-semibold">{pct}%</b>
          <Badge value={epic.status} />
          <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => create({ project_id: epic.project_id, epic_id: epic.id, issue_type: 'STORY' })}>
            Add story
          </Button>
          <Button size="sm" onClick={() => setOpen(!open)}>
            {open ? 'Hide items' : `Show ${items.length} items`}
          </Button>
        </div>
      </div>
      {open && (
        <div className="border-t border-line bg-subtle">
          <IssueList issues={items} empty={<p className="py-4 text-center text-[12.5px] text-ink-3">No items in this epic yet.</p>} />
        </div>
      )}
    </Card>
  );
}

export default function EpicsPage() {
  const pid = Number(useParams<{ projectId: string }>().projectId);
  const query = useIssues(pid);
  const create = useCreateIssue();
  const [hideDone, setHideDone] = useState(false);
  const issues = query.data ?? [];
  const epics = issues.filter((i) => i.issue_type === 'EPIC').filter((e) => !hideDone || e.status !== 'DONE');
  const ungrouped = issues.filter((i) => !['EPIC', 'SUBTASK'].includes(i.issue_type) && !i.epic_id);
  return (
    <>
      <PageBar
        crumbs={['Epics']}
        projectId={pid}
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => create({ project_id: pid, issue_type: 'EPIC' })}>
            Create epic
          </Button>
        }
      />
      <PageBody>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-ink-2">Large bodies of work and how far each one has come.</p>
          <Switch checked={hideDone} onChange={setHideDone} label="Hide completed epics" />
        </div>
        <State loading={query.isLoading} error={query.error} empty={!query.isLoading && !epics.length} emptyText="Create an epic to group related stories." />
        <div className="flex flex-col gap-2.5">
          {epics.map((epic) => (
            <EpicCard key={epic.id} epic={epic} items={issues.filter((i) => i.epic_id === epic.id)} />
          ))}
        </div>
        {ungrouped.length > 0 && (
          <p className="mt-4 text-[12.5px] text-ink-2">
            {ungrouped.length} stories, tasks and bugs are not in an epic.{' '}
            <Link href={`/projects/${pid}/backlog`} className="font-medium text-accent-ink hover:underline">
              Group them in the backlog →
            </Link>
          </p>
        )}
      </PageBody>
    </>
  );
}
