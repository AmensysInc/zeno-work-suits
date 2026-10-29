'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useData } from '@/hooks/data';
import { issueTypes, label, priorities, statuses, type Issue, type ProjectReport, type Sprint } from '@/types';
import { fullName, percent } from '@/lib/qa';
import { PageBar, PageBody } from '@/components/layout/page';
import { Avatar, Card, CardHeader, Kpi, State } from '@/components/ui/display';
import { Select } from '@/components/ui/select';
import { PriorityIcon, StatusIcon, TypeIcon, statusMeta } from '@/components/ui/glyphs';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { BarList, BarsChart, Legend, TrendChart } from '@/components/charts';

const priorityColor: Record<string, string> = { LOW: '#9ca3af', MEDIUM: '#3b82f6', HIGH: '#d97706', CRITICAL: '#e5484d' };
const count = (rows: { key: string; count: number }[], key: string) => rows.find((r) => r.key === key)?.count ?? 0;

export default function ReportsPage() {
  const pid = Number(useParams<{ projectId: string }>().projectId);
  const [sprintId, setSprintId] = useState<number | null>(null);
  const query = useData<ProjectReport>(`/projects/${pid}/reports${sprintId ? `?sprint_id=${sprintId}` : ''}`);
  const sprints = useData<Sprint[]>(`/projects/${pid}/sprints`);
  const r = query.data;
  const started = (sprints.data ?? []).filter((x) => x.status !== 'PLANNED');
  const s = r?.summary;
  const burnLast = r?.burndown?.days.filter((d) => d.remaining !== null).at(-1);
  return (
    <>
      <PageBar crumbs={['Reports']} projectId={pid} />
      <PageBody>
        {!r || !s ? (
          <State loading={query.isLoading} error={query.error} />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-ink-2">Delivery progress, sprint velocity and how work is spread across the team.</p>
            <Card className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 [&>*]:border-line max-md:[&>*:nth-child(even)]:border-l md:max-xl:[&>*:not(:nth-child(3n+1))]:border-l xl:[&>*:not(:first-child)]:border-l">
              <Kpi label="Completion" value={`${percent(s.done_points, s.total_points)}%`} hint={`${s.done_points} of ${s.total_points} points`} tone="#16a34a" />
              <Kpi label="Open items" value={s.open_issues} hint={`${s.total_issues} total`} />
              <Kpi label="Done items" value={s.done_issues} tone="#16a34a" />
              <Kpi label="Average velocity" value={s.average_velocity ?? '—'} hint="points per completed sprint" />
              <Kpi label="Average lead time" value={s.average_lead_time_days === null ? '—' : `${s.average_lead_time_days}d`} hint="created to done" />
              <Kpi label="Open bugs" value={s.open_bugs} tone={s.open_bugs ? '#e5484d' : '#16a34a'} />
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="pb-4">
                <CardHeader
                  title="Sprint burndown"
                  subtitle={r.burndown ? `${burnLast?.remaining ?? r.burndown.total_points} of ${r.burndown.total_points} points remaining` : 'Remaining story points by day'}
                  action={
                    <Select<number>
                      size="sm"
                      aria-label="Burndown sprint"
                      className="w-40"
                      placeholder="No started sprints"
                      value={sprintId ?? r.burndown?.sprint_id ?? undefined}
                      onChange={setSprintId}
                      options={started.map((x) => ({ value: x.id, label: x.name }))}
                    />
                  }
                />
                <div className="px-4 pt-3">
                  {r.burndown ? (
                    <>
                      <TrendChart
                        data={r.burndown.days.map((d) => ({ name: d.date.slice(5), remaining: d.remaining, ideal: d.ideal }))}
                        series={[{ key: 'remaining', name: 'Remaining', color: 'var(--accent)' }]}
                        reference={{ key: 'ideal', name: 'Ideal' }}
                      />
                      <Legend items={[{ label: 'Remaining points', color: 'var(--accent)' }, { label: 'Ideal', color: 'var(--ink-4)' }]} />
                    </>
                  ) : (
                    <p className="py-10 text-center text-[13px] text-ink-3">Start a sprint with start and end dates to see its burndown.</p>
                  )}
                </div>
              </Card>
              <Card className="pb-4">
                <CardHeader title="Velocity" subtitle="Committed vs completed story points per sprint" action={<Legend items={[{ label: 'Committed', color: 'var(--line-2)' }, { label: 'Completed', color: 'var(--accent)' }]} />} />
                <div className="px-4 pt-3">
                  {r.velocity.length ? (
                    <BarsChart
                      height={220}
                      data={r.velocity.map((v) => ({ name: v.name, committed: v.committed_points, completed: v.completed_points }))}
                      bars={[
                        { key: 'committed', name: 'Committed', color: 'var(--line-2)' },
                        { key: 'completed', name: 'Completed', color: 'var(--accent)' },
                      ]}
                    />
                  ) : (
                    <p className="py-10 text-center text-[13px] text-ink-3">No data yet.</p>
                  )}
                </div>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="pb-4">
                <CardHeader title="Created vs resolved" subtitle="Last 8 weeks" action={<Legend items={[{ label: 'Created', color: 'var(--accent)' }, { label: 'Resolved', color: '#16a34a' }]} />} />
                <div className="px-4 pt-3">
                  <BarsChart
                    data={r.created_vs_resolved.map((w) => ({ name: w.week.slice(5), created: w.created, resolved: w.resolved }))}
                    bars={[
                      { key: 'created', name: 'Created', color: 'var(--accent)' },
                      { key: 'resolved', name: 'Resolved', color: '#16a34a' },
                    ]}
                  />
                </div>
              </Card>
              <Card className="pb-4">
                <CardHeader title="Work items by status" />
                <div className="px-4 pt-3">
                  <BarList labelWidth={96} rows={statuses.map((k) => ({ label: statusMeta[k].label, value: count(r.by_status, k), color: statusMeta[k].color, icon: <StatusIcon status={k} /> }))} />
                </div>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="pb-4">
                <CardHeader title="Work items by priority" />
                <div className="px-4 pt-3">
                  <BarList labelWidth={96} rows={priorities.map((k) => ({ label: label(k), value: count(r.by_priority, k), color: priorityColor[k], icon: <PriorityIcon priority={k} /> }))} />
                </div>
              </Card>
              <Card className="pb-4">
                <CardHeader title="Work items by type" />
                <div className="px-4 pt-3">
                  <BarList labelWidth={96} rows={issueTypes.map((k) => ({ label: label(k), value: count(r.by_type, k), icon: <TypeIcon type={k as Issue['issue_type']} size={14} /> }))} />
                </div>
              </Card>
            </div>

            <Card className="overflow-hidden">
              <CardHeader title="Team workload" subtitle="Open and finished work per person" className="pb-3" />
              <Table>
                <thead>
                  <tr>
                    <Th>Assignee</Th>
                    <Th className="text-right">Open items</Th>
                    <Th className="text-right">Open points</Th>
                    <Th className="text-right">In flight</Th>
                    <Th className="text-right">Done</Th>
                  </tr>
                </thead>
                <tbody>
                  {r.workload.map((w) => (
                    <Tr key={w.user?.id ?? 'none'}>
                      <Td>
                        <span className="inline-flex items-center gap-2">
                          <Avatar user={w.user} size={22} />
                          {fullName(w.user)}
                        </span>
                      </Td>
                      <Td className="tnum text-right">{w.open_issues}</Td>
                      <Td className="tnum text-right">{w.open_points}</Td>
                      <Td className="tnum text-right">{w.in_progress}</Td>
                      <Td className="tnum text-right">{w.done_issues}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>
        )}
      </PageBody>
    </>
  );
}
