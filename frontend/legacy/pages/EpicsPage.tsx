import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, Checkbox, Progress as Meter, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
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
    <Card className="card epic-card">
      <div className="section-head">
        <div>
          <Typography.Text type="secondary" className="key">
            <Link to={`/issues/${epic.id}`}>{epic.issue_key}</Link> ·{' '}
            {label(epic.priority)} priority · {fullName(epic.assignee)}
          </Typography.Text>
          <Typography.Title level={4} className="epic">
            <Link to={`/issues/${epic.id}`}>{epic.summary}</Link>
          </Typography.Title>
        </div>
        <div className="actions">
          <Badge value={epic.status} />
          <Meter
            type="circle"
            size={44}
            percent={percent(done.length, items.length)}
          />
        </div>
      </div>
      <Progress
        rows={statuses.map((s) => ({
          key: s,
          count: items.filter((i) => i.status === s).length,
        }))}
      />
      <div className="section-head">
        <Typography.Text type="secondary">
          {done.length} of {items.length} items done · {donePoints} of {points}{' '}
          points
          {epic.due_date && ` · due ${epic.due_date}`}
        </Typography.Text>
        <div className="actions">
          <Button
            variant="ghost"
            icon={<PlusOutlined />}
            onClick={() =>
              create({
                project_id: epic.project_id,
                epic_id: epic.id,
                issue_type: 'STORY',
              })
            }
          >
            Add story
          </Button>
          <Button variant="outline" onClick={() => setOpen(!open)}>
            {open ? 'Hide items' : `Show ${items.length} items`}
          </Button>
        </div>
      </div>
      {open && <IssueTable issues={items} />}
    </Card>
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
        <Button
          icon={<PlusOutlined />}
          onClick={() => create({ project_id: pid, issue_type: 'EPIC' })}
        >
          Create epic
        </Button>
      </PageHeader>
      <Checkbox
        className="check-row"
        checked={hideDone}
        onChange={(e) => setHideDone(e.target.checked)}
      >
        Hide completed epics
      </Checkbox>
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
