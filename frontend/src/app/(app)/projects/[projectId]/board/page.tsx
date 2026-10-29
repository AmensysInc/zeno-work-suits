'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Clock, Kanban, Plus, Timer } from 'lucide-react';
import { useCanLead, useData, useIssues } from '@/hooks/data';
import type { Project, Sprint } from '@/types';
import { PageBar, PageBody } from '@/components/layout/page';
import { useCreateIssue } from '@/components/layout/context';
import { AvatarStack, Badge, Empty, State } from '@/components/ui/display';
import { Button, LinkButton } from '@/components/ui/button';
import WorkItemFilters, { useFilters } from '@/components/issues/filters';
import KanbanBoard from '@/components/board/kanban-board';
import { CompleteSprintDialog } from '@/components/sprints/sprint-dialogs';
import { shortDate } from '@/lib/utils';

// Kanban boards keep recently finished work visible, then let it drop off.
const DONE_WINDOW_DAYS = 14;

export default function BoardPage() {
  const pid = Number(useParams<{ projectId: string }>().projectId);
  const project = useData<Project>(`/projects/${pid}`);
  const sprints = useData<Sprint[]>(`/projects/${pid}/sprints`);
  const query = useIssues(pid);
  const filters = useFilters();
  const create = useCreateIssue();
  const canLead = useCanLead(pid);
  const [completing, setCompleting] = useState(false);
  const kanban = project.data?.board_type === 'KANBAN';
  const active = sprints.data?.find((s) => s.status === 'ACTIVE');
  const cutoff = new Date(Date.now() - DONE_WINDOW_DAYS * 86400000).toISOString();
  const scope =
    query.data?.filter((i) =>
      i.issue_type === 'EPIC' ? false : kanban ? i.status !== 'BACKLOG' && (i.status !== 'DONE' || i.updated_at >= cutoff) : i.sprint_id === active?.id,
    ) ?? [];
  const items = scope.filter(filters.matches);
  const points = scope.reduce((n, i) => n + i.story_points, 0);
  const done = scope.filter((i) => i.status === 'DONE').reduce((n, i) => n + i.story_points, 0);
  const loading = sprints.isLoading || query.isLoading || project.isLoading;
  const showBoard = kanban || active;
  const daysLeft = active?.end_date ? Math.ceil((new Date(`${active.end_date}T23:59:59`).getTime() - Date.now()) / 86400000) : null;
  return (
    <>
      <PageBar
        crumbs={['Board']}
        projectId={pid}
        actions={
          kanban ? (
            <Button variant="primary" icon={<Plus />} onClick={() => create({ project_id: pid })}>
              Create issue
            </Button>
          ) : (
            <>
              {project.data && <span className="hidden md:inline-flex"><AvatarStack users={project.data.members} size={24} /></span>}
              <LinkButton href={`/projects/${pid}/sprints`} icon={<Timer className="size-3.5" />}>
                <span className="hidden sm:inline">Sprint planning</span>
              </LinkButton>
              {active && canLead && <Button onClick={() => setCompleting(true)}>Complete sprint</Button>}
            </>
          )
        }
      />
      {showBoard && !loading && (
        <WorkItemFilters state={filters} fields={['type', 'priority', 'assignee']} members={project.data?.members}>
          <div className="flex flex-col items-end text-right">
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              {kanban ? 'Kanban flow' : active!.name}
              {daysLeft !== null && !kanban && (
                <Badge tone={daysLeft <= 2 ? 'amber' : 'gray'} icon={<Clock />}>
                  {daysLeft < 0 ? 'Past end date' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
                </Badge>
              )}
            </span>
            <span className="text-[11.5px] text-ink-3">
              {kanban
                ? `${scope.length} items · finished work stays for ${DONE_WINDOW_DAYS} days`
                : `${active!.goal || 'No goal set'} · ${shortDate(active!.start_date)} — ${shortDate(active!.end_date)} · ${done} / ${points} pts done`}
            </span>
          </div>
        </WorkItemFilters>
      )}
      <PageBody padded={false} className="flex flex-col">
        <State loading={loading} error={sprints.error || query.error || project.error} />
        {showBoard && !loading && <KanbanBoard projectId={pid} issues={items} all={query.data ?? []} sprintId={kanban ? undefined : active?.id} />}
        {!showBoard && !loading && (
          <Empty icon={<Kanban />} title="No active sprint">
            Plan a sprint, add issues, and start it when your team is ready.
            <div className="mt-3">
              <LinkButton variant="primary" href={`/projects/${pid}/backlog`}>
                Go to backlog
              </LinkButton>
            </div>
          </Empty>
        )}
      </PageBody>
      {completing && active && <CompleteSprintDialog sprint={active} sprints={sprints.data ?? []} issues={query.data ?? []} onClose={() => setCompleting(false)} />}
    </>
  );
}
