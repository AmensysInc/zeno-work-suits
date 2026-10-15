import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useIssues } from '../hooks/data';
import { label, statuses, type Issue } from '../types';
import { fullName, percent } from '../lib/qa';
import { Badge, PageHeader, State } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/charts';
import { useCreateIssue } from '../components/layout/AppShell';
import IssueTable from '../components/issues/IssueTable';

function EpicCard({ epic, items }: { epic: Issue; items: Issue[] }) {
  const create = useCreateIssue();
  const [open, setOpen] = useState(false);
  const done = items.filter((i) => i.status === 'DONE');
  const points = items.reduce((n, i) => n + i.story_points, 0);
  const donePoints = done.reduce((n, i) => n + i.story_points, 0);
  return (
    <section className="card epic-card">
      <div className="section-head">
        <div>
          <p className="key">
            <Link to={`/issues/${epic.id}`}>{epic.issue_key}</Link> ·{' '}
            {label(epic.priority)} priority · {fullName(epic.assignee)}
          </p>
          <h2 className="epic">
            <Link to={`/issues/${epic.id}`}>{epic.summary}</Link>
          </h2>
        </div>
        <div className="actions">
          <Badge value={epic.status} />
          <strong>{percent(done.length, items.length)}%</strong>
        </div>
      </div>
      <Progress
        rows={statuses.map((s) => ({
          key: s,
          count: items.filter((i) => i.status === s).length,
        }))}
      />
      <div className="section-head">
        <span className="muted">
          {done.length} of {items.length} items done · {donePoints} of {points}{' '}
          points
          {epic.due_date && ` · due ${epic.due_date}`}
        </span>
        <div className="actions">
          <Button
            variant="ghost"
            onClick={() =>
              create({
                project_id: epic.project_id,
                epic_id: epic.id,
                issue_type: 'STORY',
              })
            }
          >
            + Add story
          </Button>
          <Button variant="outline" onClick={() => setOpen(!open)}>
            {open ? 'Hide items' : `Show ${items.length} items`}
          </Button>
        </div>
      </div>
      {open && <IssueTable issues={items} />}
    </section>
  );
}

export default function EpicsPage() {
  const pid = Number(useParams().projectId);
  const query = useIssues(pid);
  const create = useCreateIssue();
  const [hideDone, setHideDone] = useState(false);
  const issues = query.data ?? [];
  const epics = issues
    .filter((i) => i.issue_type === 'EPIC')
    .filter((e) => !hideDone || e.status !== 'DONE');
  const ungrouped = issues.filter(
    (i) => !['EPIC', 'SUBTASK'].includes(i.issue_type) && !i.epic_id,
  );
  return (
    <>
      <PageHeader
        title="Epics"
        description="Large bodies of work and how far each one has come."
      >
        <Button onClick={() => create({ project_id: pid, issue_type: 'EPIC' })}>
          + Create epic
        </Button>
      </PageHeader>
      <label className="check-row">
        <input
          type="checkbox"
          checked={hideDone}
          onChange={(e) => setHideDone(e.target.checked)}
        />
        Hide completed epics
      </label>
      <State
        loading={query.isLoading}
        error={query.error}
        empty={!query.isLoading && !epics.length}
      />
      {epics.map((epic) => (
        <EpicCard
          key={epic.id}
          epic={epic}
          items={issues.filter((i) => i.epic_id === epic.id)}
        />
      ))}
      {ungrouped.length > 0 && (
        <p className="backlog-note">
          {ungrouped.length} stories, tasks and bugs are not in an epic.{' '}
          <Link to={`/projects/${pid}/backlog`}>
            Group them in the backlog →
          </Link>
        </p>
      )}
    </>
  );
}
