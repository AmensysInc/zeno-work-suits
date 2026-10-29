import { type Issue, statuses, issueTypes } from '../../types';
import { BarChart } from '../ui/charts';

export default function IssueCharts({ issues }: { issues: Issue[] }) {
  const count = (field: 'status' | 'issue_type', values: readonly string[]) =>
    values.map((key) => ({
      key,
      count: issues.filter((i) => i[field] === key).length,
    }));
  return (
    <div className="chart-grid">
      <BarChart title="Issues by status" rows={count('status', statuses)} />
      <BarChart title="Issues by type" rows={count('issue_type', issueTypes)} />
    </div>
  );
}
