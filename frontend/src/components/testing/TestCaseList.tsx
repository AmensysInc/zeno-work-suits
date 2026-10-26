import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Input, Statistic, Table, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useData } from '../../hooks/data';
import type { Issue, TestCase } from '../../types';
import { testStatuses, testTypes } from '../../types';
import { Badge, State } from '../ui/shared';
import { LinkButton } from '../ui/button';
import { Select, labelled } from '../ui/form';
/** Story test cases, or (with projectId) the filterable project repository. */
export default function TestCaseList({
  issueId,
  projectId,
}: {
  issueId?: number;
  projectId?: number;
}) {
  const query = useData<TestCase[]>(
    issueId
      ? `/test-cases?issue_id=${issueId}`
      : `/test-cases?project_id=${projectId}`,
    !!(issueId || projectId),
  );
  const issues = useData<Issue[]>(
    `/issues?project_id=${projectId}`,
    !!projectId,
  );
  const [search, setSearch] = useState('');
  const [story, setStory] = useState(0);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const stories = issues.data?.filter((i) => i.issue_type === 'STORY') ?? [];
  const all = query.data ?? [];
  const items = all.filter(
    (t) =>
      (!search ||
        `${t.test_case_key} ${t.title}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (!story || t.issue_id === story) &&
      (!status || t.status === status) &&
      (!type || t.test_type === type),
  );
  return (
    <>
      <div className="test-stats">
        {[
          ['Total', all.length],
          ['Passed', all.filter((t) => t.status === 'PASSED').length],
          ['Failed', all.filter((t) => t.status === 'FAILED').length],
          ['Blocked', all.filter((t) => t.status === 'BLOCKED').length],
          ['Not run', all.filter((t) => t.status === 'NOT_RUN').length],
        ].map(([name, n]) => (
          <Statistic key={name} title={name} value={n} />
        ))}
      </div>
      <Card
        className="card"
        title="Test cases"
        extra={
          <LinkButton
            icon={<PlusOutlined />}
            to={`/test-cases/new${issueId ? `?story=${issueId}` : ''}`}
          >
            Add test case
          </LinkButton>
        }
      >
        {projectId && (
          <div className="filters">
            <Input.Search
              allowClear
              aria-label="Search test cases"
              placeholder="Search by key or title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              aria-label="Filter by story"
              value={story}
              onChange={(v) => setStory(Number(v))}
              options={[
                { value: 0, label: 'All stories' },
                ...stories.map((s) => ({
                  value: s.id,
                  label: `${s.issue_key} — ${s.summary}`,
                })),
              ]}
            />
            <Select
              aria-label="Filter by result"
              value={status}
              onChange={setStatus}
              options={[
                { value: '', label: 'All results' },
                ...labelled(testStatuses),
              ]}
            />
            <Select
              aria-label="Filter by type"
              value={type}
              onChange={setType}
              options={[
                { value: '', label: 'All types' },
                ...labelled(testTypes),
              ]}
            />
          </div>
        )}
        <State
          loading={query.isLoading}
          error={query.error}
          empty={items.length === 0 && !query.isLoading}
        />
        {!!items.length && (
          <Table
            rowKey="id"
            size="middle"
            dataSource={items}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 25, hideOnSinglePage: true }}
            columns={[
              {
                title: 'Key',
                dataIndex: 'test_case_key',
                render: (key, t) => (
                  <Link to={`/test-cases/${t.id}`}>{key}</Link>
                ),
              },
              {
                title: 'Title',
                dataIndex: 'title',
                render: (title, t) => (
                  <Link className="summary-link" to={`/test-cases/${t.id}`}>
                    {title}
                  </Link>
                ),
              },
              ...(projectId
                ? [
                    {
                      title: 'Story',
                      key: 'story',
                      render: (_: unknown, t: TestCase) => (
                        <Link to={`/issues/${t.issue_id}`}>
                          {stories.find((s) => s.id === t.issue_id)?.issue_key}
                        </Link>
                      ),
                    },
                  ]
                : []),
              {
                title: 'Type',
                dataIndex: 'test_type',
                render: (v) => <Badge value={v} />,
              },
              {
                title: 'Covers',
                key: 'covers',
                render: (_, t) => (
                  <Typography.Text
                    type={t.criterion_ids.length ? 'secondary' : 'warning'}
                  >
                    {t.criterion_ids.length
                      ? `${t.criterion_ids.length} criteria`
                      : 'None'}
                  </Typography.Text>
                ),
              },
              {
                title: 'Steps',
                key: 'steps',
                render: (_, t) => t.steps.length,
              },
              {
                title: 'Last run',
                dataIndex: 'last_executed_on',
                render: (v) => v ?? 'Never',
              },
              {
                title: 'Result',
                dataIndex: 'status',
                render: (v) => <Badge value={v} />,
              },
            ]}
          />
        )}
      </Card>
    </>
  );
}
