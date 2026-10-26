import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, Descriptions, Table, Tag, Typography } from 'antd';
import {
  CaretRightOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useData, useSave } from '../hooks/data';
import type { Criterion, Issue, TestCase } from '../types';
import { label } from '../types';
import { PageHeader, State, Badge } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import { confirm } from '../components/ui/confirm';
import TestCaseForm from '../components/testing/TestCaseForm';
import RunTestModal from '../components/testing/RunTestModal';
import ExecutionHistory from '../components/testing/ExecutionHistory';
import { usePageProject } from '../components/layout/AppShell';
export default function TestCaseDetailsPage() {
  const { testCaseId } = useParams();
  const query = useData<TestCase>(`/test-cases/${testCaseId}`);
  const tc = query.data;
  const story = useData<Issue>(`/issues/${tc?.issue_id}`, !!tc);
  const criteria = useData<Criterion[]>(
    `/issues/${tc?.issue_id}/acceptance-criteria`,
    !!tc,
  );
  const del = useSave(
    `/test-cases/${testCaseId}`,
    'delete',
    'Test case deleted',
  );
  const nav = useNavigate();
  const [editing, setEditing] = useState(false);
  const [running, setRunning] = useState(false);
  usePageProject(tc?.project_id);
  if (!tc) return <State loading={query.isLoading} error={query.error} />;
  const covered = criteria.data?.filter((c) => tc.criterion_ids.includes(c.id));
  return (
    <>
      <PageHeader
        title={editing ? 'Edit test case' : tc.title}
        description={`${tc.test_case_key} · ${label(tc.test_type)} · ${tc.steps.length} steps`}
      >
        {!editing && (
          <Button
            icon={<CaretRightOutlined />}
            onClick={() => setRunning(true)}
          >
            Run test
          </Button>
        )}
        <Button
          variant="outline"
          icon={<EditOutlined />}
          onClick={() => setEditing(!editing)}
        >
          {editing ? 'Close editor' : 'Edit'}
        </Button>
        <Button
          variant="destructive"
          icon={<DeleteOutlined />}
          onClick={async () => {
            if (
              !(await confirm(
                'Delete this test case, its steps and its run history?',
                { okText: 'Delete' },
              ))
            )
              return;
            try {
              await del.mutateAsync({});
              nav(`/projects/${tc.project_id}/test-cases`);
            } catch {
              /*toast*/
            }
          }}
        >
          Delete
        </Button>
      </PageHeader>
      {editing ? (
        <TestCaseForm
          key={tc.updated_at}
          initial={tc}
          onSaved={() => setEditing(false)}
        />
      ) : (
        <>
          <div className="detail-grid">
            <Card className="card" title="Test steps">
              <Table
                className="steps-table"
                rowKey="id"
                size="middle"
                pagination={false}
                dataSource={tc.steps}
                columns={[
                  { title: '#', dataIndex: 'step_number', width: 48 },
                  {
                    title: 'Action',
                    dataIndex: 'action',
                    render: (action, s) => (
                      <>
                        {action}{' '}
                        {s.shared_step_id && (
                          <Tag color="blue" title="Reusable step">
                            Reusable
                          </Tag>
                        )}
                      </>
                    ),
                  },
                  {
                    title: 'Test data',
                    dataIndex: 'test_data',
                    className: 'prewrap muted',
                    render: (v) => v || '—',
                  },
                  {
                    title: 'Expected result',
                    dataIndex: 'expected_result',
                    className: 'prewrap',
                  },
                ]}
              />
              <Typography.Title level={5} className="spaced">
                Preconditions
              </Typography.Title>
              <p className="prewrap">{tc.preconditions || 'None specified'}</p>
              <Typography.Title level={5} className="spaced">
                Expected result
              </Typography.Title>
              <p className="prewrap">
                {tc.expected_result || 'None specified'}
              </p>
              <Typography.Title level={5} className="spaced">
                Test data
              </Typography.Title>
              <p className="prewrap">{tc.test_data || 'None specified'}</p>
            </Card>
            <Card className="card details-panel" title="Details">
              <Descriptions
                column={1}
                size="small"
                className="details-list"
                items={[
                  {
                    label: 'Latest result',
                    children: <Badge value={tc.status} />,
                  },
                  {
                    label: 'Last run',
                    children: tc.last_executed_on ?? 'Never',
                  },
                  { label: 'Runs', children: tc.execution_count },
                  {
                    label: 'Priority',
                    children: <Badge value={tc.priority} />,
                  },
                  {
                    label: 'User story',
                    children: (
                      <Link to={`/issues/${tc.issue_id}`}>
                        {story.data
                          ? `${story.data.issue_key} ${story.data.summary}`
                          : 'View story'}
                      </Link>
                    ),
                  },
                  ...(tc.ai_source?.source_commit
                    ? [
                        {
                          label: 'Generated from',
                          children: `${tc.ai_source.repository}${tc.ai_source.module_path ? ` / ${tc.ai_source.module_path}` : ''} @${tc.ai_source.source_commit.slice(0, 7)}`,
                        },
                      ]
                    : []),
                ]}
              />
              <Typography.Title level={5} className="spaced">
                Covers acceptance criteria
              </Typography.Title>
              {covered?.length ? (
                <ul className="covered">
                  {covered.map((c) => (
                    <li key={c.id}>{c.description}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">
                  Not linked to any criterion. Edit the test to add coverage.
                </p>
              )}
            </Card>
          </div>
          <ExecutionHistory testCase={tc} />
        </>
      )}
      {running && (
        <RunTestModal testCase={tc} onClose={() => setRunning(false)} />
      )}
    </>
  );
}
