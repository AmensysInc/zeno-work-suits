import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, Select, Table, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
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
  return (
    <>
      <PageHeader
        title="All Work Items"
        description="Every epic, story, task, bug and subtask in this project."
      >
        <Button
          icon={<PlusOutlined />}
          onClick={() => create({ project_id: pid })}
        >
          Create issue
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
      <Card
        className="card"
        title={`${shown.length} of ${issues.length} items`}
        extra={
          <Select
            aria-label="Sort by"
            value={sort}
            onChange={setSort}
            popupMatchSelectWidth={false}
            options={Object.entries(sorts).map(([key, [name]]) => ({
              value: key,
              label: `Sort: ${name}`,
            }))}
          />
        }
      >
        <State loading={query.isLoading} error={query.error} />
        {!query.isLoading && (
          <Table
            rowKey="id"
            size="middle"
            dataSource={shown}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 50, hideOnSinglePage: true }}
            rowSelection={{
              selectedRowKeys: [...selected],
              onChange: (keys) => setSelected(new Set(keys as number[])),
            }}
            columns={[
              {
                title: 'Key',
                dataIndex: 'issue_key',
                render: (key, i) => <Link to={`/issues/${i.id}`}>{key}</Link>,
              },
              {
                title: 'Summary',
                dataIndex: 'summary',
                render: (summary, i) => (
                  <Link className="summary-link" to={`/issues/${i.id}`}>
                    {summary}
                  </Link>
                ),
              },
              {
                title: 'Type',
                dataIndex: 'issue_type',
                render: (v) => <Badge value={v} />,
              },
              {
                title: 'Status',
                dataIndex: 'status',
                render: (v) => <Badge value={v} />,
              },
              {
                title: 'Priority',
                dataIndex: 'priority',
                render: (v) => (
                  <Typography.Text
                    type={v === 'CRITICAL' ? 'danger' : 'secondary'}
                  >
                    {label(v)}
                  </Typography.Text>
                ),
              },
              {
                title: 'Assignee',
                key: 'assignee',
                render: (_, i) => fullName(i.assignee),
              },
              {
                title: 'Sprint',
                key: 'sprint',
                render: (_, i) =>
                  sprints.data?.find((s) => s.id === i.sprint_id)?.name ??
                  (i.issue_type === 'EPIC' ? '—' : 'Backlog'),
              },
              {
                title: 'Parent / Epic',
                key: 'parent',
                render: (_, i) => {
                  const parent = byId.get(i.parent_issue_id ?? i.epic_id ?? 0);
                  return parent ? (
                    <Link to={`/issues/${parent.id}`}>{parent.issue_key}</Link>
                  ) : (
                    '—'
                  );
                },
              },
              { title: 'Points', dataIndex: 'story_points' },
            ]}
          />
        )}
      </Card>
    </>
  );
}
