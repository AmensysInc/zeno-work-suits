import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useData, useIssues } from '../hooks/data';
import {
  label,
  priorities,
  statuses,
  type Issue,
  type Project,
  type Sprint,
} from '../types';
import { fullName } from '../lib/qa';
import { Badge, PageHeader, State } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import { useCreateIssue } from '../components/layout/AppShell';
import WorkItemFilters, {
  useFilters,
} from '../components/issues/WorkItemFilters';
import BulkActions from '../components/issues/BulkActions';

const sorts: Record<string, [string, (a: Issue, b: Issue) => number]> = {
  rank: ['Rank', (a, b) => a.order_index - b.order_index || a.id - b.id],
  updated: [
    'Recently updated',
    (a, b) => b.updated_at.localeCompare(a.updated_at),
  ],
  created: ['Newest', (a, b) => b.id - a.id],
  priority: [
    'Priority',
    (a, b) => priorities.indexOf(b.priority) - priorities.indexOf(a.priority),
  ],
  status: [
    'Status',
    (a, b) => statuses.indexOf(a.status) - statuses.indexOf(b.status),
  ],
  points: ['Story points', (a, b) => b.story_points - a.story_points],
};

export default function WorkItemsPage() {
  const pid = Number(useParams().projectId);
  const project = useData<Project>(`/projects/${pid}`);
  const query = useIssues(pid);
  const sprints = useData<Sprint[]>(`/projects/${pid}/sprints`);
  const create = useCreateIssue();
  const filters = useFilters();
  const [sort, setSort] = useState('rank');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const issues = query.data ?? [];
  const byId = new Map(issues.map((i) => [i.id, i]));
  const shown = issues.filter(filters.matches).sort(sorts[sort][1]);
  const allShown = shown.length > 0 && shown.every((i) => selected.has(i.id));
  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <>
      <PageHeader
        title="All Work Items"
        description="Every epic, story, task, bug and subtask in this project."
      >
        <Button onClick={() => create({ project_id: pid })}>
          + Create issue
        </Button>
      </PageHeader>
      <WorkItemFilters
        state={filters}
        fields={['type', 'status', 'priority', 'assignee', 'sprint', 'epic']}
        members={project.data?.members}
        epics={issues.filter((i) => i.issue_type === 'EPIC')}
        sprints={sprints.data}
      />
      <BulkActions
        ids={[...selected]}
        members={project.data?.members ?? []}
        sprints={sprints.data ?? []}
        onDone={() => setSelected(new Set())}
      />
      <section className="card">
        <div className="section-head">
          <h2>
            {shown.length} of {issues.length} items
          </h2>
          <div className="actions">
            <select
              aria-label="Sort by"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              {Object.entries(sorts).map(([key, [name]]) => (
                <option key={key} value={key}>
                  Sort: {name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <State
          loading={query.isLoading}
          error={query.error}
          empty={!query.isLoading && !shown.length}
        />
        {shown.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select all shown"
                      checked={allShown}
                      onChange={() =>
                        setSelected(
                          allShown
                            ? new Set()
                            : new Set(shown.map((i) => i.id)),
                        )
                      }
                    />
                  </th>
                  <th>Key</th>
                  <th>Summary</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assignee</th>
                  <th>Sprint</th>
                  <th>Parent / Epic</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((i) => {
                  const parent = byId.get(i.parent_issue_id ?? i.epic_id ?? 0);
                  return (
                    <tr key={i.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${i.issue_key}`}
                          checked={selected.has(i.id)}
                          onChange={() => toggle(i.id)}
                        />
                      </td>
                      <td className="key">
                        <Link to={`/issues/${i.id}`}>{i.issue_key}</Link>
                      </td>
                      <td>
                        <Link to={`/issues/${i.id}`}>{i.summary}</Link>
                      </td>
                      <td>
                        <Badge value={i.issue_type} />
                      </td>
                      <td>
                        <Badge value={i.status} />
                      </td>
                      <td
                        className={
                          i.priority === 'CRITICAL' ? 'error' : 'muted'
                        }
                      >
                        {label(i.priority)}
                      </td>
                      <td className="muted">{fullName(i.assignee)}</td>
                      <td className="muted">
                        {sprints.data?.find((s) => s.id === i.sprint_id)
                          ?.name ?? (i.issue_type === 'EPIC' ? '—' : 'Backlog')}
                      </td>
                      <td className="muted">
                        {parent ? (
                          <Link to={`/issues/${parent.id}`}>
                            {parent.issue_key}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{i.story_points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
