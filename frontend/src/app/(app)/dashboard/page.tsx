'use client';

import Link from 'next/link';
import { Bug, CircleCheck, Clock, Inbox, RefreshCw } from 'lucide-react';
import { useIssues, useMe, useProjects } from '@/hooks/data';
import { issueTypes, label, priorities, statuses, type Issue } from '@/types';
import { percent } from '@/lib/qa';
import { PageBar, PageBody } from '@/components/layout/page';
import { Card, CardHeader, Progress, State, projectColor } from '@/components/ui/display';
import { IssueKey, PriorityIcon, StatusIcon, TypeIcon, statusMeta } from '@/components/ui/glyphs';
import { BarList, Donut, Legend, TrendChart } from '@/components/charts';
import IssueList from '@/components/issues/issue-list';

const WEEKS = 8;
const DAY = 864e5;

/** Monday 00:00 of the week containing `date`. */
function weekStart(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Items created and finished per week; "finished" is when an item last moved to Done, as in Reports. */
function weekly(issues: Issue[]) {
  const first = weekStart(new Date(Date.now() - (WEEKS - 1) * 7 * DAY));
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(first.getTime() + i * 7 * DAY);
    return { name: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), created: 0, completed: 0 };
  });
  const slot = (iso: string) => {
    const i = Math.floor((new Date(iso).getTime() - first.getTime()) / (7 * DAY));
    return i >= 0 && i < WEEKS ? weeks[i] : undefined;
  };
  for (const issue of issues) {
    const created = slot(issue.created_at);
    if (created) created.created += 1;
    if (issue.status === 'DONE') {
      const done = slot(issue.resolved_at ?? issue.updated_at);
      if (done) done.completed += 1;
    }
  }
  return weeks;
}

function Tile({ label: name, value, color, foot, icon, extra }: { label: string; value: number; color: string; foot: string; icon: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-1.5 px-4 py-3.5">
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-[7px] [&_svg]:size-3.5" style={{ background: `${color}14`, color }}>
          {icon}
        </span>
        <span className="text-[12.5px] font-medium text-ink-2">{name}</span>
      </div>
      <span className="tnum mt-1 text-[26px] font-semibold leading-none tracking-tight">{value}</span>
      {extra}
      <span className="text-[11.5px] text-ink-3">{foot}</span>
    </Card>
  );
}

export default function DashboardPage() {
  const query = useIssues();
  const projects = useProjects();
  const me = useMe();
  const issues = (query.data ?? []).filter((i) => i.issue_type !== 'EPIC');
  const open = issues.filter((i) => i.status !== 'DONE');
  const done = issues.length - open.length;
  const today = new Date().toLocaleDateString('en-CA');
  const overdue = open.filter((i) => i.due_date && i.due_date < today).sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  const critical = open.filter((i) => i.issue_type === 'BUG' && i.priority === 'CRITICAL');
  const inFlight = issues.filter((i) => ['IN_PROGRESS', 'CODE_REVIEW', 'TESTING'].includes(i.status)).length;
  const byProject = (projects.data ?? [])
    .map((p) => {
      const items = issues.filter((i) => i.project_id === p.id);
      return { p, open: items.filter((i) => i.status !== 'DONE').length, done: items.filter((i) => i.status === 'DONE').length };
    })
    .filter((x) => x.open + x.done > 0)
    .sort((a, b) => b.open + b.done - (a.open + a.done))
    .slice(0, 8);
  const people = new Map<string, number>();
  for (const i of open) {
    const name = i.assignee ? `${i.assignee.first_name} ${i.assignee.last_name[0]}.` : 'Unassigned';
    people.set(name, (people.get(name) ?? 0) + 1);
  }
  const workload = [...people].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const hour = new Date().getHours();

  return (
    <>
      <PageBar crumbs={['Home']} />
      <PageBody>
        <div className="mb-4 flex flex-col gap-0.5">
          <span className="text-[11.5px] font-medium text-ink-3">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          <h1 className="text-[24px] font-semibold tracking-tight">
            Good {hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}, {me.data?.first_name ?? 'there'}
          </h1>
          <p className="text-[13px] text-ink-2">Here’s what’s happening across your {projects.data?.length ?? ''} projects.</p>
        </div>
        <State loading={query.isLoading} error={query.error} />
        {query.data && (
          <div className="flex flex-col gap-3.5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              <Tile label="Open work" value={open.length} color="#4f46e5" foot="Not done, across all projects" icon={<Inbox />} />
              <Tile label="In progress" value={inFlight} color="#e8a317" foot="In progress, review & testing" icon={<RefreshCw />} />
              <Tile
                label="Completed"
                value={done}
                color="#16a34a"
                foot={`${percent(done, issues.length)}% of all work items`}
                icon={<CircleCheck />}
                extra={<Progress className="my-0.5 h-[5px]" parts={[{ value: percent(done, issues.length), color: '#16a34a' }]} />}
              />
              <Tile label="Overdue" value={overdue.length} color="#d97706" foot="Past their due date" icon={<Clock />} />
              <Tile label="Critical bugs" value={critical.length} color="#e5484d" foot="Open bugs, critical priority" icon={<Bug />} />
            </div>

            <div className="grid gap-3.5 xl:grid-cols-[1.7fr_1fr]">
              <Card>
                <CardHeader
                  title="Created vs completed"
                  subtitle={`Work items per week · last ${WEEKS} weeks`}
                  action={<Legend items={[{ label: 'Created', color: '#4f46e5' }, { label: 'Completed', color: '#16a34a' }]} />}
                />
                <div className="px-3 pb-3 pt-3">
                  <TrendChart
                    data={weekly(issues)}
                    series={[
                      { key: 'created', name: 'Created', color: '#4f46e5' },
                      { key: 'completed', name: 'Completed', color: '#16a34a' },
                    ]}
                  />
                </div>
              </Card>
              <Card>
                <CardHeader title="Workflow" subtitle="Items in each status" />
                <div className="flex items-center gap-5 p-4">
                  <Donut
                    center={issues.length}
                    sub="items"
                    parts={statuses.map((s) => ({ name: label(s), value: issues.filter((i) => i.status === s).length, color: statusMeta[s].color }))}
                  />
                  <div className="flex flex-1 flex-col gap-1">
                    {statuses.map((s) => (
                      <div key={s} className="flex items-center justify-between text-[12.5px]">
                        <span className="inline-flex items-center gap-1.5 text-ink-2">
                          <StatusIcon status={s} />
                          {statusMeta[s].label}
                        </span>
                        <b className="tnum font-semibold">{issues.filter((i) => i.status === s).length}</b>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid gap-3.5 lg:grid-cols-2 xl:grid-cols-4">
              <Card className="xl:col-span-2">
                <CardHeader
                  title="Work by project"
                  subtitle="Open and done · click a project to open it"
                  action={<Legend items={[{ label: 'Open', color: 'var(--accent)' }, { label: 'Done', color: 'var(--accent)', dim: true }]} />}
                />
                <div className="p-4 pt-3">
                  {byProject.length ? (
                    <BarList rows={byProject.map(({ p, open: o, done: d }) => ({ label: p.name, value: o, extra: d, color: projectColor(p.id), href: `/projects/${p.id}` }))} />
                  ) : (
                    <p className="text-[13px] text-ink-3">No work yet.</p>
                  )}
                </div>
              </Card>
              <Card className="xl:col-span-2">
                <CardHeader title="Team workload" subtitle="Open items per person" />
                <div className="p-4 pt-3">
                  {workload.length ? <BarList labelWidth={96} rows={workload.map(([name, n]) => ({ label: name, value: n, color: name === 'Unassigned' ? 'var(--ink-4)' : undefined }))} /> : <p className="text-[13px] text-ink-3">Nothing open.</p>}
                </div>
              </Card>
              <Card>
                <CardHeader title="Open work by priority" subtitle="Low to critical" />
                <div className="p-4 pt-3">
                  <BarList labelWidth={70} rows={priorities.map((p) => ({ label: label(p), value: open.filter((i) => i.priority === p).length, icon: <PriorityIcon priority={p} />, color: p === 'CRITICAL' ? '#e5484d' : p === 'HIGH' ? '#d97706' : undefined }))} />
                </div>
              </Card>
              <Card>
                <CardHeader title="Open work by type" subtitle="Stories, tasks, bugs, subtasks" />
                <div className="p-4 pt-3">
                  <BarList
                    labelWidth={70}
                    rows={issueTypes.filter((t) => t !== 'EPIC').map((t) => ({ label: label(t), value: open.filter((i) => i.issue_type === t).length, icon: <TypeIcon type={t} size={14} /> }))}
                  />
                </div>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader title="Overdue" subtitle="Open items past their due date" />
                <div className="p-2 pt-2">
                  {overdue.length ? (
                    overdue.slice(0, 6).map((i) => (
                      <Link key={i.id} href={`/issues/${i.id}`} className="flex h-9 items-center gap-2.5 rounded-md px-2 hover:bg-hover">
                        <TypeIcon type={i.issue_type} size={15} />
                        <IssueKey>{i.issue_key}</IssueKey>
                        <span className="flex-1 truncate text-[13px]">{i.summary}</span>
                        <span className="inline-flex items-center gap-1 text-xs text-red-600">
                          <Clock className="size-3" />
                          due {i.due_date}
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p className="flex items-center gap-2 px-2 py-3 text-[13px] text-ink-2">
                      <CircleCheck className="size-4 text-green-600" />
                      Nothing overdue. Nice work!
                    </p>
                  )}
                </div>
              </Card>
            </div>

            <Card className="overflow-hidden">
              <CardHeader className="pb-3" title="Recently updated" subtitle="Latest movement across your projects" action={<Link href="/my-issues" className="text-xs font-medium text-ink-2 hover:text-ink">My issues →</Link>} />
              <div className="border-t border-line">
                <IssueList showProject issues={[...issues].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8)} />
              </div>
            </Card>
          </div>
        )}
      </PageBody>
    </>
  );
}
