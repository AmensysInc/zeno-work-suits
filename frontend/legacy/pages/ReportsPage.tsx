import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Table } from 'antd';
import { useData } from '../hooks/data';
import type { ProjectReport, Sprint } from '../types';
import { fullName, percent } from '../lib/qa';
import { PageHeader, State } from '../components/ui/shared';
import { BarChart, Kpi } from '../components/ui/charts';
import { Select } from '../components/ui/form';

type Series = { key: string; name: string };

/** Side-by-side columns per group, e.g. committed vs completed per sprint. */
function ColumnChart({
  title,
  series,
  groups,
}: {
  title: string;
  series: Series[];
  groups: { label: string; values: number[] }[];
}) {
  const max = Math.max(1, ...groups.flatMap((g) => g.values));
  return (
    <Card className="card chart" title={title}>
      {groups.length === 0 ? (
        <p className="muted">No data yet.</p>
      ) : (
        <div className="column-chart">
          {groups.map((g) => (
            <div className="group" key={g.label}>
              <div className="bars">
                {g.values.map((v, i) => (
                  <span
                    key={series[i].key}
                    className={`bar-${series[i].key}`}
                    style={{ height: `${(v / max) * 100}%` }}
                    title={`${series[i].name}: ${v}`}
                  />
                ))}
              </div>
              <small>{g.label}</small>
            </div>
          ))}
        </div>
      )}
      <div className="legend">
        {series.map((s) => (
          <span key={s.key}>
            <i className={`bar-${s.key}`} />
            {s.name}
          </span>
        ))}
      </div>
    </Card>
  );
}

function Burndown({ data }: { data: NonNullable<ProjectReport['burndown']> }) {
  const w = 600;
  const h = 200;
  const max = Math.max(1, data.total_points);
  const step = w / Math.max(1, data.days.length - 1);
  const y = (v: number) => h - (v / max) * h;
  const line = (values: (number | null)[]) =>
    values
      .map((v, i) => (v === null ? null : `${i * step},${y(v)}`))
      .filter(Boolean)
      .join(' ');
  const last = data.days.filter((d) => d.remaining !== null).at(-1);
  return (
    <div className="burndown">
      <svg
        viewBox={`-28 -8 ${w + 36} ${h + 28}`}
        role="img"
        aria-label={`Burndown for ${data.name}: ${last?.remaining ?? data.total_points} of ${data.total_points} points remaining`}
      >
        <line className="axis" x1="0" y1={h} x2={w} y2={h} />
        <line className="axis" x1="0" y1="0" x2="0" y2={h} />
        <text x="-6" y="4" textAnchor="end">
          {data.total_points}
        </text>
        <text x="-6" y={h} textAnchor="end">
          0
        </text>
        <polyline
          className="ideal"
          points={line(data.days.map((d) => d.ideal))}
        />
        <polyline
          className="actual"
          points={line(data.days.map((d) => d.remaining))}
        />
        {data.days.map(
          (d, i) =>
            (i === 0 || i === data.days.length - 1 || i % 5 === 0) && (
              <text key={d.date} x={i * step} y={h + 18} textAnchor="middle">
                {d.date.slice(5)}
              </text>
            ),
        )}
      </svg>
      <div className="legend">
        <span>
          <i className="bar-in_progress" />
          Remaining points{' '}
          <strong>{last?.remaining ?? data.total_points}</strong>
        </span>
        <span>
          <i className="bar-skipped" />
          Ideal
        </span>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const pid = Number(useParams().projectId);
  const [sprintId, setSprintId] = useState('');
  const query = useData<ProjectReport>(
    `/projects/${pid}/reports${sprintId ? `?sprint_id=${sprintId}` : ''}`,
  );
  const sprints = useData<Sprint[]>(`/projects/${pid}/sprints`);
  const r = query.data;
  if (!r) return <State loading={query.isLoading} error={query.error} />;
  const s = r.summary;
  const started = (sprints.data ?? []).filter((x) => x.status !== 'PLANNED');
  return (
    <>
      <PageHeader
        title="Reports"
        description="Delivery progress, sprint velocity and how work is spread across the team."
      />
      <div className="kpis kpis-6">
        <Kpi
          name="Completion"
          value={`${percent(s.done_points, s.total_points)}%`}
          hint={`${s.done_points} of ${s.total_points} points`}
          tone="good"
        />
        <Kpi
          name="Open items"
          value={s.open_issues}
          hint={`${s.total_issues} total`}
        />
        <Kpi name="Done items" value={s.done_issues} tone="good" />
        <Kpi
          name="Average velocity"
          value={s.average_velocity ?? '—'}
          hint="points per completed sprint"
        />
        <Kpi
          name="Average lead time"
          value={
            s.average_lead_time_days === null
              ? '—'
              : `${s.average_lead_time_days}d`
          }
          hint="created to done"
        />
        <Kpi
          name="Open bugs"
          value={s.open_bugs}
          tone={s.open_bugs ? 'bad' : 'good'}
        />
      </div>
      <div className="chart-grid-2">
        <Card
          className="card"
          title="Sprint burndown"
          extra={
            <Select
              aria-label="Burndown sprint"
              className="inline-select"
              placeholder="No started sprints"
              value={sprintId || r.burndown?.sprint_id || ''}
              onChange={setSprintId}
              options={started.map((x) => ({ value: x.id, label: x.name }))}
            />
          }
        >
          {r.burndown ? (
            <Burndown data={r.burndown} />
          ) : (
            <p className="muted">
              Start a sprint with start and end dates to see its burndown.
            </p>
          )}
        </Card>
        <ColumnChart
          title="Velocity · story points"
          series={[
            { key: 'committed', name: 'Committed' },
            { key: 'completed', name: 'Completed' },
          ]}
          groups={r.velocity.map((v) => ({
            label: v.name,
            values: [v.committed_points, v.completed_points],
          }))}
        />
      </div>
      <div className="chart-grid-2">
        <ColumnChart
          title="Created vs resolved · last 8 weeks"
          series={[
            { key: 'created', name: 'Created' },
            { key: 'resolved', name: 'Resolved' },
          ]}
          groups={r.created_vs_resolved.map((w) => ({
            label: w.week.slice(5),
            values: [w.created, w.resolved],
          }))}
        />
        <BarChart title="Work items by status" rows={r.by_status} />
      </div>
      <div className="chart-grid-2">
        <BarChart title="Work items by priority" rows={r.by_priority} />
        <BarChart title="Work items by type" rows={r.by_type} />
      </div>
      <Card className="card" title="Team workload">
        <Table
          rowKey={(w) => w.user?.id ?? 'none'}
          size="middle"
          pagination={false}
          dataSource={r.workload}
          scroll={{ x: 'max-content' }}
          columns={[
            {
              title: 'Assignee',
              key: 'user',
              render: (_, w) => fullName(w.user),
            },
            { title: 'Open items', dataIndex: 'open_issues' },
            { title: 'Open points', dataIndex: 'open_points' },
            { title: 'In flight', dataIndex: 'in_progress' },
            { title: 'Done', dataIndex: 'done_issues' },
          ]}
        />
      </Card>
    </>
  );
}
