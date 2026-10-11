import { useIssues, useMe } from '../hooks/data';
import { PageHeader, State } from '../components/ui/shared';
import IssueCharts from '../components/issues/IssueCharts';
import IssueTable from '../components/issues/IssueTable';
export default function DashboardPage() {
  const query = useIssues();
  const me = useMe();
  const issues = query.data ?? [];
  const stats = [
    ['Open issues', issues.filter((i) => i.status !== 'DONE').length],
    ['In progress', issues.filter((i) => i.status === 'IN_PROGRESS').length],
    ['Completed', issues.filter((i) => i.status === 'DONE').length],
    [
      'Critical bugs',
      issues.filter(
        (i) =>
          i.issue_type === 'BUG' &&
          i.priority === 'CRITICAL' &&
          i.status !== 'DONE',
      ).length,
    ],
  ];
  return (
    <>
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${me.data?.first_name ?? 'there'}`}
        description="Here’s what’s happening across your projects."
      />
      <State loading={query.isLoading} error={query.error} />
      <div className="stats">
        {stats.map(([name, value], index) => (
          <section className="card stat" key={name}>
            <p>{name}</p>
            <strong>{value}</strong>
            <img alt="" src={`/assets/imgEllipse${index + 3}.svg`} />
          </section>
        ))}
      </div>
      <div className="dashboard-detail">
        <section className="card">
          <h2>Recent issues</h2>
          <IssueTable
            issues={[...issues]
              .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
              .slice(0, 6)}
          />
        </section>
        <IssueCharts issues={issues} />
      </div>
    </>
  );
}
