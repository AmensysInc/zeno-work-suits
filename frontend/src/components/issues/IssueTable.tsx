import { Link } from 'react-router-dom';
import { Table, Tag, Typography, type TableColumnsType } from 'antd';
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
  const columns: TableColumnsType<Issue> = [
    {
      title: 'Key',
      dataIndex: 'issue_key',
      render: (key, i) => <Link to={`/issues/${i.id}`}>{key}</Link>,
    },
    ...(showProject
      ? [
          {
            title: 'Project',
            key: 'project',
            render: (_: unknown, i: Issue) => (
              <Link to={`/projects/${i.project_id}`}>
                {projects.data?.find((p) => p.id === i.project_id)?.name ?? '—'}
              </Link>
            ),
          },
        ]
      : []),
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
      render: (type) => <Badge value={type} />,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      render: (priority) => (
        <Typography.Text
          type={priority === 'CRITICAL' ? 'danger' : 'secondary'}
        >
          {label(priority)}
        </Typography.Text>
      ),
    },
    sprints
      ? {
          title: 'Points',
          dataIndex: 'story_points',
          render: (points) => <Tag variant="filled">{points} pts</Tag>,
        }
      : {
          title: 'Status',
          dataIndex: 'status',
          render: (status) => <Badge value={status} />,
        },
    sprints
      ? {
          title: 'Sprint',
          key: 'sprint',
          render: (_, i) => (
            <Typography.Text type="secondary">
              {sprints.find((s) => s.id === i.sprint_id)?.name ?? 'Backlog'}
            </Typography.Text>
          ),
        }
      : {
          title: 'Assignee',
          key: 'assignee',
          render: (_, i) => (
            <Typography.Text type="secondary">
              {i.assignee
                ? `${i.assignee.first_name} ${i.assignee.last_name[0]}.`
                : 'Unassigned'}
            </Typography.Text>
          ),
        },
  ];
  return (
    <Table
      rowKey="id"
      size="middle"
      columns={columns}
      dataSource={issues}
      pagination={issues.length > 20 ? { pageSize: 20 } : false}
      scroll={{ x: 'max-content' }}
    />
  );
}
