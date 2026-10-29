'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Kanban, List, Plus } from 'lucide-react';
import { useData, useIssues } from '@/hooks/data';
import { issueTypes, label, projectDates, statuses, type Project, type Sprint } from '@/types';
import { percent } from '@/lib/qa';
import { PageBar, PageBody } from '@/components/layout/page';
import { useCreateIssue } from '@/components/layout/context';
import { Avatar, Badge, Card, CardHeader, Kpi, Progress, State, Tag } from '@/components/ui/display';
import { Button, LinkButton } from '@/components/ui/button';
import { GithubIcon, StatusIcon, TypeIcon, statusMeta } from '@/components/ui/glyphs';
import { BarList, StackedBar } from '@/components/charts';
import IssueList from '@/components/issues/issue-list';
import { cn, shortDate } from '@/lib/utils';

export default function ProjectPage() {
  const pid = Number(useParams<{ projectId: string }>().projectId);
  const query = useData<Project>(`/projects/${pid}`);
  const issues = useIssues(pid);
  const sprints = useData<Sprint[]>(`/projects/${pid}/sprints`);
  const create = useCreateIssue();
  const p = query.data;
  const all = issues.data ?? [];
  const work = all.filter((i) => i.issue_type !== 'EPIC');
  const epics = all.filter((i) => i.issue_type === 'EPIC');
  const active = sprints.data?.find((s) => s.status === 'ACTIVE');
  const next = sprints.data?.filter((s) => s.status === 'PLANNED').sort((a, b) => a.id - b.id)[0];
  const sprintItems = work.filter((i) => i.sprint_id === active?.id);
  const kanban = p?.board_type === 'KANBAN';
  const flow = kanban ? work : sprintItems;
  const today = new Date().toLocaleDateString('en-CA');
  const milestones = projectDates.filter(([name]) => p?.[name]);
  return (
    <>
      <PageBar
        crumbs={['Overview']}
        projectId={pid}
        actions={
          <>
            <LinkButton href={`/projects/${pid}/backlog`} icon={<List className="size-3.5" />} className="hidden sm:inline-flex">
              Open backlog
            </LinkButton>
            <Button variant="primary" icon={<Plus />} onClick={() => create({ project_id: pid })}>
              New issue
            </Button>
          </>
        }
      />
      <PageBody>
        <State loading={query.isLoading} error={query.error} />
        {p && (
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-semibold tracking-tight">{p.name}</h1>
                <Badge value={p.status} />
                <Tag>{kanban ? 'Kanban' : 'Scrum'}</Tag>
                {p.github_repo && (
                  <a href={p.github_repo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink">
                    <GithubIcon className="size-3.5" /> Repository ↗
                  </a>
                )}
              </div>
              <p className="text-[13px] text-ink-2">{p.description || 'No description yet.'}</p>
            </div>

            <Card className="grid grid-cols-2 lg:grid-cols-4 [&>*:not(:first-child)]:border-l [&>*]:border-line">
              <Kpi label="Open work items" value={work.filter((i) => i.status !== 'DONE').length} hint={`${work.length} total`} />
              <Kpi label="In progress" value={work.filter((i) => ['IN_PROGRESS', 'CODE_REVIEW', 'TESTING'].includes(i.status)).length} tone="#d97706" />
              <Kpi label="Done" value={work.filter((i) => i.status === 'DONE').length} tone="#16a34a" />
              <Kpi label="Open bugs" value={work.filter((i) => i.issue_type === 'BUG' && i.status !== 'DONE').length} tone="#e5484d" />
            </Card>

            <Card className="flex flex-col gap-6 p-[18px] lg:flex-row">
              <div className="flex flex-[1.3] flex-col gap-2.5">
                <span className="caps">{kanban ? 'Kanban flow' : 'Active sprint'}</span>
                {kanban || active ? (
                  <>
                    {active && !kanban && (
                      <>
                        <span className="text-[17px] font-semibold tracking-tight">{active.name}</span>
                        <span className="text-[12.5px] text-ink-2">
                          {active.goal || 'No goal set'} · {shortDate(active.start_date)} — {shortDate(active.end_date)} ·{' '}
                          {sprintItems.filter((i) => i.status === 'DONE').reduce((n, i) => n + i.story_points, 0)} of {sprintItems.reduce((n, i) => n + i.story_points, 0)} points done
                        </span>
                      </>
                    )}
                    <StackedBar parts={statuses.map((s) => ({ label: statusMeta[s].label, value: flow.filter((i) => i.status === s).length, color: statusMeta[s].color }))} />
                    <LinkButton href={`/projects/${pid}/board`} size="sm" icon={<Kanban className="size-3" />} className="self-start">
                      Open board
                    </LinkButton>
                  </>
                ) : (
                  <p className="text-[13px] text-ink-2">
                    {next ? `${next.name} is planned. Start it from the backlog when the team is ready.` : 'Create a sprint in the backlog to start planning.'}
                  </p>
                )}
              </div>
              {milestones.length > 0 && (
                <>
                  <div className="hidden w-px bg-line lg:block" />
                  <div className="flex flex-1 flex-col gap-3">
                    <span className="caps">Milestones</span>
                    <div className="flex items-start">
                      {milestones.map(([name, title], i) => {
                        const passed = p[name]! <= today;
                        return (
                          <div key={name} className="flex flex-1 flex-col gap-1.5">
                            <div className="flex items-center">
                              <span className={cn('size-3 shrink-0 rounded-full border-2', passed ? 'border-accent bg-accent' : 'border-line-2 bg-surface')} />
                              {i < milestones.length - 1 && <span className={cn('h-0.5 flex-1', passed ? 'bg-accent' : 'bg-line')} />}
                            </div>
                            <span className="text-[11.5px] text-ink-3">{title}</span>
                            <span className="text-[12.5px] font-semibold">{shortDate(p[name])}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </Card>

            <div className="grid gap-3.5 xl:grid-cols-[1fr_1.25fr_250px]">
              <Card>
                <CardHeader title="Epics" action={<Link href={`/projects/${pid}/epics`} className="text-xs font-medium text-ink-2 hover:text-ink">All epics →</Link>} />
                <div className="flex flex-col gap-3 p-4">
                  {!epics.length && <p className="text-[13px] text-ink-3">No epics yet.</p>}
                  {epics.slice(0, 5).map((e) => {
                    const items = all.filter((i) => i.epic_id === e.id);
                    const done = items.filter((i) => i.status === 'DONE').length;
                    return (
                      <Link key={e.id} href={`/issues/${e.id}`} className="flex flex-col gap-1.5 rounded-md hover:opacity-80">
                        <div className="flex items-center gap-2">
                          <TypeIcon type="EPIC" size={16} />
                          <span className="flex-1 truncate font-medium">{e.summary}</span>
                          <span className="tnum text-[11.5px] text-ink-3">
                            {done}/{items.length}
                          </span>
                          <b className="tnum w-9 text-right text-[12.5px]">{percent(done, items.length)}%</b>
                        </div>
                        <Progress className="h-[5px]" parts={[{ value: percent(done, items.length), color: '#7c3aed' }]} />
                      </Link>
                    );
                  })}
                </div>
              </Card>
              <Card className="overflow-hidden">
                <CardHeader className="pb-3" title="Recently updated" action={<Link href={`/projects/${pid}/work-items`} className="text-xs font-medium text-ink-2 hover:text-ink">All work items →</Link>} />
                <div className="border-t border-line">
                  <State loading={issues.isLoading} error={issues.error} />
                  <IssueList issues={[...all].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6)} />
                </div>
              </Card>
              <Card>
                <CardHeader title="Team" subtitle={`${p.team.length} members`} action={<Link href={`/projects/${pid}/settings`} className="text-xs font-medium text-ink-2 hover:text-ink">Manage</Link>} />
                <div className="flex flex-col gap-2.5 p-4">
                  {p.team.map((m) => (
                    <div key={m.user.id} className="flex items-center gap-2">
                      <Avatar user={m.user} size={24} />
                      <span className="flex-1 truncate text-[12.5px] font-medium">
                        {m.user.first_name} {m.user.last_name}
                      </span>
                      <span className="text-[11.5px] text-ink-3">{label(m.role)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="grid gap-3.5 lg:grid-cols-2">
              <Card>
                <CardHeader title="Issues by status" />
                <div className="p-4 pt-3">
                  <BarList labelWidth={92} rows={statuses.map((s) => ({ label: statusMeta[s].label, value: work.filter((i) => i.status === s).length, color: statusMeta[s].color, icon: <StatusIcon status={s} /> }))} />
                </div>
              </Card>
              <Card>
                <CardHeader title="Issues by type" />
                <div className="p-4 pt-3">
                  <BarList labelWidth={92} rows={issueTypes.map((t) => ({ label: label(t), value: all.filter((i) => i.issue_type === t).length, icon: <TypeIcon type={t} size={14} /> }))} />
                </div>
              </Card>
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
