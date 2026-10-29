import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card, Table, Tag, Typography } from 'antd';
import { BugOutlined, DeleteOutlined } from '@ant-design/icons';
import { useCanLead, useData, useIssues, useMe, useSave } from '../../hooks/data';
import type { Execution, Sprint, TestCase } from '../../types';
import { bugFromRun, fullName } from '../../lib/qa';
import { Badge, State } from '../ui/shared';
import { Button } from '../ui/button';
import { confirm } from '../ui/confirm';
import { useCreateIssue } from '../layout/AppShell';
import RunTestModal from './RunTestModal';

function DeleteRun({ id, allowed }: { id: number; allowed: boolean }) {
  const del = useSave(`/test-executions/${id}`, 'delete', 'Test run deleted');
  if (!allowed) return null;
  return (
    <Button
      variant="ghost"
      size="small"
      icon={<DeleteOutlined />}
      aria-label="Delete test run"
      disabled={del.isPending}
      onClick={async () => {
        if (
          await confirm('Delete this test run? Its step results are lost.', {
            okText: 'Delete',
          })
        )
          del.mutate({});
      }}
    />
  );
}

export default function ExecutionHistory({
  testCase: tc,
}: {
  testCase: TestCase;
}) {
  const runs = useData<Execution[]>(`/test-executions?test_case_id=${tc.id}`);
  const me = useMe();
  const canLead = useCanLead(tc.project_id);
  const sprints = useData<Sprint[]>(`/projects/${tc.project_id}/sprints`);
  const issues = useIssues(tc.project_id);
  const create = useCreateIssue();
  const [open, setOpen] = useState<Execution | null>(null);
  const { hash } = useLocation();
  const loaded = !!runs.data;
  useEffect(() => {
    if (loaded && hash.startsWith('#run'))
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [loaded, hash]);
  const bugs =
    issues.data?.filter(
      (i) => i.issue_type === 'BUG' && i.related_test_case_id === tc.id,
    ) ?? [];
  return (
    <Card
      className="card"
      id="runs"
      title="Execution history"
      extra={
        <Typography.Text type="secondary">
          {runs.data?.length ?? 0} run{runs.data?.length === 1 ? '' : 's'}
        </Typography.Text>
      }
    >
      <State
        loading={runs.isLoading}
        error={runs.error}
        empty={!runs.isLoading && !runs.data?.length}
      />
      {!!runs.data?.length && (
        <Table
          rowKey="id"
          size="middle"
          pagination={false}
          scroll={{ x: 'max-content' }}
          dataSource={runs.data}
          onRow={(run) => ({ id: `run-${run.id}` })}
          rowClassName={(run) => (hash === `#run-${run.id}` ? 'highlight' : '')}
          columns={[
            { title: 'Date', dataIndex: 'executed_on' },
            {
              title: 'Actual result',
              key: 'actual',
              className: 'wrap',
              render: (_, run) => (
                <>
                  <Button
                    variant="ghost"
                    size="small"
                    className="link"
                    onClick={() => setOpen(run)}
                  >
                    {run.actual_result || 'View step results'}
                  </Button>
                  {run.environment && (
                    <span className="muted"> · {run.environment}</span>
                  )}
                </>
              ),
            },
            {
              title: 'Result',
              dataIndex: 'status',
              render: (v) => <Badge value={v} />,
            },
            {
              title: 'Tester',
              key: 'tester',
              render: (_, run) => fullName(run.tester),
            },
            {
              title: 'Sprint',
              key: 'sprint',
              render: (_, run) =>
                sprints.data?.find((s) => s.id === run.sprint_id)?.name ?? '—',
            },
            {
              title: 'Defects',
              key: 'defects',
              render: (_, run) => {
                const linked = bugs.filter(
                  (b) => b.related_execution_id === run.id,
                );
                return (
                  <>
                    {linked.map((b) => (
                      <Link key={b.id} to={`/issues/${b.id}`}>
                        <Tag color="red">{b.issue_key}</Tag>
                      </Link>
                    ))}
                    {run.status === 'FAILED' && !linked.length && (
                      <Button
                        variant="destructive"
                        size="small"
                        icon={<BugOutlined />}
                        onClick={() => create(bugFromRun(tc, run))}
                      >
                        Log bug
                      </Button>
                    )}
                  </>
                );
              },
            },
            {
              key: 'delete',
              render: (_, run) => (
                <DeleteRun
                  id={run.id}
                  allowed={canLead || run.tester_id === me.data?.id}
                />
              ),
            },
          ]}
        />
      )}
      {open && (
        <RunTestModal
          testCase={tc}
          execution={open}
          onClose={() => setOpen(null)}
        />
      )}
    </Card>
  );
}
