import { useNavigate } from 'react-router-dom';
import { Card, Progress, Statistic } from 'antd';
import {
  BugOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  InboxOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useIssues, useMe, useProjects } from '../hooks/data';
import { issueTypes, label, priorities, statuses, type Issue } from '../types';
import { percent } from '../lib/qa';
import { PageHeader, State } from '../components/ui/shared';
import IssueTable from '../components/issues/IssueTable';
import {
  BarsChart,
  ChartCard,
  TrendChart,
  ramp,
  series,
} from '../components/dashboard/Charts';

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
    return {
      name: start.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      start: start.getTime(),
      created: 0,
      completed: 0,
    };
  });
  const slot = (iso: string) => {
    const t = new Date(iso).getTime();
    const i = Math.floor((t - first.getTime()) / (7 * DAY));
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
  return weeks.map(({ name, created, completed }) => ({
    name,
    created,
    completed,
  }));
}

export default function DashboardPage() {
  const query = useIssues();
  const projects = useProjects();
  const me = useMe();
  const nav = useNavigate();
  const issues = (query.data ?? []).filter((i) => i.issue_type !== 'EPIC');
  const open = issues.filter((i) => i.status !== 'DONE');
  const done = issues.length - open.length;
  const today = new Date().toLocaleDateString('en-CA');
  const overdue = open.filter((i) => i.due_date && i.due_date < today);
  const critical = open.filter(
    (i) => i.issue_type === 'BUG' && i.priority === 'CRITICAL',
  );
  const tiles = [
    ['Open work', open.length, <InboxOutlined />, '#4f6ef7', null],
    [
      'In progress',
      issues.filter((i) =>
        ['IN_PROGRESS', 'CODE_REVIEW', 'TESTING'].includes(i.status),
      ).length,
      <SyncOutlined />,
      '#7a52f2',
      null,
    ],
    [
      'Completed',
      done,
      <CheckCircleOutlined />,
      '#219e6b',
      percent(done, issues.length),
    ],
    ['Overdue', overdue.length, <ClockCircleOutlined />, '#d48806', null],
    ['Critical bugs', critical.length, <BugOutlined />, '#dc3c3c', null],
  ] as const;

  const byProject = (projects.data ?? [])
    .map((p) => {
      const items = issues.filter((i) => i.project_id === p.id);
      return {
        name: p.name,
        id: p.id,
        open: items.filter((i) => i.status !== 'DONE').length,
        done: items.filter((i) => i.status === 'DONE').length,
      };
    })
    .filter((p) => p.open + p.done > 0)
    .sort((a, b) => b.open + b.done - (a.open + a.done))
    .slice(0, 8);
  const people = new Map<string, number>();
  for (const i of open) {
    const name = i.assignee
      ? `${i.assignee.first_name} ${i.assignee.last_name[0]}.`
      : 'Unassigned';
    people.set(name, (people.get(name) ?? 0) + 1);
  }
  const workload = [...people]
    .map(([name, count]) => ({ name, open: count }))
    .sort((a, b) => b.open - a.open)
    .slice(0, 8);

  return (
    <>
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${me.data?.first_name ?? 'there'}`}
        description="Here’s what’s happening across your projects."
      />
      <State loading={query.isLoading} error={query.error} />
      {query.data && (
        <>
          <div className="stats stats-5">
            {tiles.map(([name, value, icon, color, rate]) => (
              <Card className="card stat" key={name}>
                <Statistic
                  title={name}
                  value={value}
                  prefix={
                    <span className="stat-icon" style={{ color }}>
                      {icon}
                    </span>
                  }
                />
                {rate !== null && (
                  <Progress
                    percent={rate}
                    size="small"
                    strokeColor="#219e6b"
                    format={(p) => `${p}% done`}
                  />
                )}
              </Card>
            ))}
          </div>

          <div className="dash-grid">
            <ChartCard
              className="span-2"
              title="Created vs completed"
              subtitle={`Work items per week · last ${WEEKS} weeks`}
              empty={!issues.length}
            >
              <TrendChart
                data={weekly(issues)}
                lines={[
                  { key: 'created', name: 'Created', color: series[0] },
                  { key: 'completed', name: 'Completed', color: series[1] },
                ]}
              />
            </ChartCard>
            <ChartCard
              title="Workflow"
              subtitle="Items in each status"
              empty={!issues.length}
            >
              <BarsChart
                horizontal
                height={260}
                data={statuses.map((s) => ({
                  name: label(s),
                  items: issues.filter((i) => i.status === s).length,
                }))}
                bars={[{ key: 'items', name: 'Items', color: series[0] }]}
              />
            </ChartCard>

            <ChartCard
              className="span-2"
              title="Work by project"
              subtitle="Open and done items · click a project to open it"
              empty={!byProject.length}
            >
              <BarsChart
                horizontal
                height={Math.max(160, byProject.length * 44 + 40)}
                data={byProject}
                bars={[
                  { key: 'open', name: 'Open', color: series[0] },
                  { key: 'done', name: 'Done', color: series[1] },
                ]}
                onSelect={(d) => nav(`/projects/${d.id}`)}
              />
            </ChartCard>
            <ChartCard
              title="Team workload"
              subtitle="Open items per person"
              empty={!workload.length}
            >
              <BarsChart
                horizontal
                height={Math.max(160, workload.length * 40 + 20)}
                data={workload}
                bars={[{ key: 'open', name: 'Open items', color: series[0] }]}
              />
            </ChartCard>

            <ChartCard
              title="Open work by priority"
              subtitle="Low to critical"
              empty={!open.length}
            >
              <BarsChart
                height={220}
                data={priorities.map((p) => ({
                  name: label(p),
                  items: open.filter((i) => i.priority === p).length,
                }))}
                bars={[{ key: 'items', name: 'Open items', color: ramp[1] }]}
                colors={ramp}
              />
            </ChartCard>
            <ChartCard
              title="Open work by type"
              subtitle="Stories, tasks, bugs and subtasks"
              empty={!open.length}
            >
              <BarsChart
                height={220}
                data={issueTypes
                  .filter((t) => t !== 'EPIC')
                  .map((t) => ({
                    name: label(t),
                    items: open.filter((i) => i.issue_type === t).length,
                  }))}
                bars={[{ key: 'items', name: 'Open items', color: series[0] }]}
              />
            </ChartCard>
            <ChartCard
              title="Overdue"
              subtitle="Open items past their due date"
              empty={false}
            >
              {overdue.length ? (
                <ul className="overdue-list">
                  {overdue
                    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
                    .slice(0, 6)
                    .map((i) => (
                      <li key={i.id}>
                        <a
                          href={`/issues/${i.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            nav(`/issues/${i.id}`);
                          }}
                        >
                          <span className="key">{i.issue_key}</span> {i.summary}
                        </a>
                        <small>
                          <ClockCircleOutlined /> due {i.due_date}
                        </small>
                      </li>
                    ))}
                </ul>
              ) : (
                <div className="all-clear">
                  <CheckCircleOutlined /> Nothing overdue. Nice work!
                </div>
              )}
            </ChartCard>
          </div>

          <Card className="card" title="Recent issues">
            <IssueTable
              showProject
              issues={[...issues]
                .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
                .slice(0, 8)}
            />
          </Card>
        </>
      )}
    </>
  );
}
