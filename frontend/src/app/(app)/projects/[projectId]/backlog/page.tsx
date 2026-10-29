'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Kanban, Plus, Timer } from 'lucide-react';
import { useCanLead, useData, useIssues } from '@/hooks/data';
import type { Issue, Project, Sprint } from '@/types';
import { PageBar, PageBody } from '@/components/layout/page';
import { useCreateIssue } from '@/components/layout/context';
import { Button, LinkButton } from '@/components/ui/button';
import { State } from '@/components/ui/display';
import { Switch, Tabs } from '@/components/ui/controls';
import { TypeIcon } from '@/components/ui/glyphs';
import WorkItemFilters, { useFilters } from '@/components/issues/filters';
import BulkActions from '@/components/issues/bulk-actions';
import IssueList from '@/components/issues/issue-list';
import PlanningBoard from '@/components/sprints/planning-board';
import { CompleteSprintDialog, SprintDialog } from '@/components/sprints/sprint-dialogs';
import { shortDate } from '@/lib/utils';

const sprintOrder = (a: Sprint, b: Sprint) =>
  Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') || (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999') || a.id - b.id;

export default function BacklogPage() {
  const pid = Number(useParams<{ projectId: string }>().projectId);
  const project = useData<Project>(`/projects/${pid}`);
  const query = useIssues(pid);
  const sprints = useData<Sprint[]>(`/projects/${pid}/sprints`);
  const create = useCreateIssue();
  const filters = useFilters();
  const canLead = useCanLead(pid);
  const [view, setView] = useState<'plan' | 'epics'>('plan');
  const [showDone, setShowDone] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<{ kind: 'new' | 'edit' | 'start' | 'complete'; sprint?: Sprint } | null>(null);
  const kanban = project.data?.board_type === 'KANBAN';
  const all = sprints.data ?? [];
  const openSprints = all.filter((s) => s.status !== 'COMPLETED').sort(sprintOrder);
  const issues = query.data ?? [];
  const epics = issues.filter((i) => i.issue_type === 'EPIC');
  const members = project.data?.members ?? [];
  const visible = (i: Issue) => filters.matches(i) && (showDone || i.status !== 'DONE');
  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const inFlow = issues.filter((i) => i.issue_type !== 'EPIC' && !['BACKLOG', 'DONE'].includes(i.status) && filters.matches(i));

  return (
    <>
      <PageBar
        crumbs={['Backlog']}
        projectId={pid}
        actions={
          <>
            {!kanban && canLead && (
              <Button icon={<Timer />} onClick={() => setModal({ kind: 'new' })}>
                <span className="hidden sm:inline">Create sprint</span>
              </Button>
            )}
            <Button variant="primary" icon={<Plus />} onClick={() => create({ project_id: pid })}>
              Create issue
            </Button>
          </>
        }
      />
      <Tabs
        value={view}
        onChange={setView}
        items={[
          { key: 'plan', label: kanban ? 'Backlog' : 'Sprints & backlog' },
          { key: 'epics', label: 'By epic' },
        ]}
      />
      <WorkItemFilters state={filters} fields={['type', 'priority', 'assignee', 'epic']} members={members} epics={epics}>
        <Switch checked={showDone} onChange={setShowDone} label="Show done items" />
      </WorkItemFilters>
      <BulkActions ids={[...selected]} members={members} sprints={kanban ? [] : all} onDone={() => setSelected(new Set())} />
      <PageBody padded={false}>
        <State loading={query.isLoading || sprints.isLoading} error={query.error || sprints.error} />
        {view === 'plan' ? (
          <>
            {kanban && (
              <section>
                <div className="flex h-[52px] items-center gap-2.5 border-b border-line bg-subtle px-3 sm:px-[18px]">
                  <span className="text-[13px] font-semibold">On the board</span>
                  <span className="flex-1 text-xs text-ink-3">{inFlow.length} items</span>
                  <LinkButton size="sm" href={`/projects/${pid}/board`} icon={<Kanban className="size-3" />}>
                    Open board
                  </LinkButton>
                </div>
                <IssueList issues={inFlow} empty={<p className="border-b border-line py-4 text-center text-[12.5px] text-ink-3">Nothing on the board yet.</p>} />
              </section>
            )}
            {query.data && (
              <PlanningBoard
                projectId={pid}
                issues={issues}
                sprints={kanban ? [] : all}
                zones={kanban ? [] : openSprints}
                filter={visible}
                backlogFilter={(i) => !kanban || ['BACKLOG', 'DONE'].includes(i.status)}
                selection={{ ids: selected, toggle }}
                sprintHead={(s) => {
                  const points = issues.filter((i) => i.sprint_id === s.id).reduce((n, i) => n + i.story_points, 0);
                  const over = points > s.capacity;
                  return (
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="truncate">
                        {s.goal || 'No goal set'} · {s.start_date ? `${shortDate(s.start_date)}${s.end_date ? ` — ${shortDate(s.end_date)}` : ''}` : 'Not scheduled'}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span className="flex h-[5px] w-24 overflow-hidden rounded-full bg-hover">
                          <i className="block h-full" style={{ width: `${Math.min(100, (points / Math.max(1, s.capacity)) * 100)}%`, background: over ? '#e5484d' : 'var(--accent)' }} />
                        </span>
                        <span className={over ? 'font-semibold text-red-600' : ''}>
                          {points}/{s.capacity} pts{over && ' · over capacity'}
                        </span>
                      </span>
                    </span>
                  );
                }}
                sprintActions={(s) =>
                  canLead ? (
                    <span className="flex items-center gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'edit', sprint: s })}>
                        Edit
                      </Button>
                      {s.status === 'PLANNED' ? (
                        <Button size="sm" onClick={() => setModal({ kind: 'start', sprint: s })}>
                          Start sprint
                        </Button>
                      ) : (
                        <>
                          <LinkButton size="sm" href={`/projects/${pid}/board`}>
                            Board
                          </LinkButton>
                          <Button size="sm" onClick={() => setModal({ kind: 'complete', sprint: s })}>
                            Complete sprint
                          </Button>
                        </>
                      )}
                    </span>
                  ) : s.status !== 'PLANNED' ? (
                    <LinkButton size="sm" href={`/projects/${pid}/board`}>
                      Board
                    </LinkButton>
                  ) : null
                }
              />
            )}
          </>
        ) : (
          [...epics.filter((e) => !filters.filters.epic || String(e.id) === filters.filters.epic), null].map((epic) => {
            const items = issues.filter((i) => i.issue_type !== 'EPIC' && i.epic_id === (epic?.id ?? null) && visible(i));
            if (!items.length && !epic) return null;
            return (
              <section key={epic?.id ?? 'none'}>
                <div className="flex h-[52px] items-center gap-2.5 border-b border-line bg-subtle px-3 sm:px-[18px]">
                  {epic && <TypeIcon type="EPIC" size={16} />}
                  {epic ? (
                    <Link href={`/issues/${epic.id}`} className="truncate text-[13px] font-semibold hover:text-accent-ink">
                      {epic.summary}
                    </Link>
                  ) : (
                    <span className="text-[13px] font-semibold">Ungrouped issues</span>
                  )}
                  <span className="flex-1 text-xs text-ink-3">{items.length} items</span>
                  {epic && (
                    <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => create({ project_id: pid, epic_id: epic.id })}>
                      Add
                    </Button>
                  )}
                </div>
                <IssueList issues={items} sprints={all} empty={<p className="border-b border-line py-4 text-center text-[12.5px] text-ink-3">No items in this epic.</p>} />
              </section>
            );
          })
        )}
        {!query.isLoading && query.data && issues.length === 0 && <State empty emptyText="Create your first issue to start planning." />}
      </PageBody>
      {modal?.kind === 'complete' && modal.sprint && <CompleteSprintDialog sprint={modal.sprint} sprints={all} issues={issues} onClose={() => setModal(null)} />}
      {modal && modal.kind !== 'complete' && (
        <SprintDialog
          projectId={pid}
          sprint={modal.sprint}
          start={modal.kind === 'start'}
          issues={modal.sprint ? issues.filter((i) => i.sprint_id === modal.sprint!.id) : []}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
