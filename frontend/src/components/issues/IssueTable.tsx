import { Link } from 'react-router-dom';
import type { Issue, Sprint } from '../../types';
import { label } from '../../types';
import { Badge, State } from '../ui/shared';
import { useProjects } from '../../hooks/data';
/** `showProject` adds a Project column for lists that span several projects. */
export default function IssueTable({
  issues,
  sprints,
  showProject = false,
}: {
  issues: Issue[];
  sprints?: Sprint[];
  showProject?: boolean;
}) {
  const projects = useProjects();
  if (!issues.length) return <State empty />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Key</th>
            {showProject && <th>Project</th>}
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
              {showProject && (
                <td className="muted">
                  <Link to={`/projects/${i.project_id}`}>
                    {projects.data?.find((p) => p.id === i.project_id)?.name ??
                      '—'}
                  </Link>
                </td>
              )}
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
