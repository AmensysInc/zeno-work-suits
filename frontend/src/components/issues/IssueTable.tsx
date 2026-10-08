import { Link } from 'react-router-dom';
import type { Issue, Sprint } from '../../types';
import { label } from '../../types';
import { Badge, State } from '../ui/shared';
export default function IssueTable({
  issues,
  sprints,
}: {
  issues: Issue[];
  sprints?: Sprint[];
}) {
  if (!issues.length) return <State empty />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Summary</th>
            <th>Type</th>
            <th>Priority</th>
            <th>{sprints ? 'Points' : 'Status'}</th>
            <th>{sprints ? 'Sprint' : 'Assignee'}</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((i) => (
            <tr key={i.id}>
              <td className="key">
                <Link to={`/issues/${i.id}`}>{i.issue_key}</Link>
              </td>
              <td>
                <Link to={`/issues/${i.id}`}>{i.summary}</Link>
              </td>
              <td>
                <Badge value={i.issue_type} />
              </td>
              <td className={i.priority === 'CRITICAL' ? 'error' : 'muted'}>
                {label(i.priority)}
              </td>
              <td>
                {sprints ? (
                  <span className="badge">{i.story_points} pts</span>
                ) : (
                  <Badge value={i.status} />
                )}
              </td>
              <td className="muted">
                {sprints
                  ? (sprints.find((s) => s.id === i.sprint_id)?.name ??
                    'Backlog')
                  : i.assignee
                    ? `${i.assignee.first_name} ${i.assignee.last_name[0]}.`
                    : 'Unassigned'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
