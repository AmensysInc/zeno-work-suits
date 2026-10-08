import { type Issue, statuses, issueTypes, label } from '../../types';

function Chart({
  title,
  values,
  issues,
  field,
}: {
  title: string;
  values: readonly string[];
  issues: Issue[];
  field: 'status' | 'issue_type';
}) {
  const counts = values.map((value) => ({
    value,
    count: issues.filter((i) => i[field] === value).length,
  }));
  const max = Math.max(1, ...counts.map((c) => c.count));
  return (
    <section className="card chart">
      <h2>{title}</h2>
      {counts.map(({ value, count }) => (
        <div className="chart-row" key={value}>
          <span>{label(value)}</span>
          <div className="bar-track">
            <div
              className={`bar bar-${value.toLowerCase()}`}
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <strong>{count}</strong>
        </div>
      ))}
    </section>
  );
}
export default function IssueCharts({ issues }: { issues: Issue[] }) {
  return (
    <div className="chart-grid">
      <Chart
        title="Issues by status"
        values={statuses}
        issues={issues}
        field="status"
      />
      <Chart
        title="Issues by type"
        values={issueTypes}
        issues={issues}
        field="issue_type"
      />
    </div>
  );
}
