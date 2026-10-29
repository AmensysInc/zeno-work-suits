import { Link, useParams } from 'react-router-dom';
import { Card, Empty, Table, Typography } from 'antd';
import { useData } from '../hooks/data';
import {
  priorities,
  testStatuses,
  type Execution,
  type Issue,
  type Project,
  type Traceability,
} from '../types';
import { fullName, healthLabel, isOpen, percent, storyHealth } from '../lib/qa';
import { PageHeader, State, Badge } from '../components/ui/shared';
import { LinkButton } from '../components/ui/button';
import { BarChart, Kpi, Progress } from '../components/ui/charts';

export default function QaDashboardPage() {
  const pid = Number(useParams().projectId);
  const project = useData<Project>(`/projects/${pid}`);
  const trace = useData<Traceability>(`/projects/${pid}/traceability`);
  const runs = useData<Execution[]>(`/test-executions?project_id=${pid}`);
  const issues = useData<Issue[]>(`/issues?project_id=${pid}`);
  const loading = trace.isLoading || runs.isLoading || issues.isLoading;
  const error = trace.error || runs.error || issues.error;
  if (!trace.data || !runs.data || !issues.data)
    return <State loading={loading} error={error} />;
  const stories = trace.data.stories;
  const tests = stories.flatMap((s) => s.test_cases);
  const criteria = stories.flatMap((s) => s.criteria);
  const bugs = issues.data.filter((i) => i.issue_type === 'BUG');
  const openBugs = bugs.filter((b) => isOpen(b.status));
  const count = (status: string) =>
    tests.filter((t) => t.status === status).length;
  const executed = tests.length - count('NOT_RUN');
  const atRisk = stories.filter((s) => storyHealth(s) !== 'READY');
  const since = new Date(Date.now() - 14 * 864e5).toLocaleDateString('en-CA');
  const recent = runs.data.filter((r) => r.executed_on >= since);
  const testers = [
    ...new Map(recent.map((r) => [r.tester_id, r.tester])).values(),
  ];
  return (
    <>
      <PageHeader
        title="QA Dashboard"
        description={`Quality at a glance for ${project.data?.name ?? 'this project'}.`}
      >
        <LinkButton variant="outline" to={`/projects/${pid}/traceability`}>
          Traceability
        </LinkButton>
        <LinkButton to={`/projects/${pid}/test-runs`}>Run tests</LinkButton>
      </PageHeader>
      <div className="kpis kpis-6">
        <Kpi
          name="Requirement coverage"
          value={`${percent(stories.filter((s) => s.test_cases.length).length, stories.length)}%`}
          hint={`${stories.filter((s) => !s.test_cases.length).length} stories without tests`}
        />
        <Kpi
          name="Criteria coverage"
          value={`${percent(criteria.filter((c) => c.test_case_ids.length).length, criteria.length)}%`}
          hint={`${criteria.length} acceptance criteria`}
        />
        <Kpi
          name="Execution progress"
          value={`${percent(executed, tests.length)}%`}
          hint={`${executed} of ${tests.length} tests run`}
        />
        <Kpi
          name="Pass rate"
          value={`${percent(count('PASSED'), executed)}%`}
          hint="of executed tests"
          tone={
            !executed
              ? undefined
              : count('PASSED') === executed
                ? 'good'
                : 'warn'
          }
        />
        <Kpi
          name="Open defects"
          value={openBugs.length}
          hint={`${openBugs.filter((b) => b.priority === 'CRITICAL').length} critical`}
          tone={
            openBugs.some((b) => b.priority === 'CRITICAL')
              ? 'bad'
              : openBugs.length
                ? 'warn'
                : 'good'
          }
        />
        <Kpi
          name="Stories ready"
          value={`${stories.length - atRisk.length}/${stories.length}`}
          hint="covered, passing, no open bugs"
        />
      </div>
      <Card className="card" title="Latest test results">
        <Progress
          rows={testStatuses.map((s) => ({ key: s, count: count(s) }))}
        />
      </Card>
      <div className="dashboard-detail">
        <Card
          className="card"
          title="Stories needing attention"
          extra={<Link to={`/projects/${pid}/traceability`}>View all →</Link>}
        >
          {!atRisk.length ? (
            <Empty description="Every story is covered, passing and free of open bugs." />
          ) : (
            <Table
              rowKey="id"
              size="middle"
              pagination={false}
              scroll={{ x: 'max-content' }}
              dataSource={atRisk.slice(0, 8)}
              columns={[
                {
                  title: 'Story',
                  dataIndex: 'issue_key',
                  render: (key, s) => (
                    <Link to={`/projects/${pid}/traceability?story=${s.id}`}>
                      {key}
                    </Link>
                  ),
                },
                {
                  title: 'Summary',
                  dataIndex: 'summary',
                  render: (summary, s) => (
                    <Link className="summary-link" to={`/issues/${s.id}`}>
                      {summary}
                    </Link>
                  ),
                },
                {
                  title: 'Criteria',
                  key: 'criteria',
                  render: (_, s) =>
                    `${s.criteria.filter((c) => c.test_case_ids.length).length}/${s.criteria.length}`,
                },
                {
                  title: 'Failing',
                  key: 'failing',
                  render: (_, s) =>
                    `${s.test_cases.filter((t) => ['FAILED', 'BLOCKED'].includes(t.status)).length}/${s.test_cases.length}`,
                },
                {
                  title: 'Open bugs',
                  key: 'bugs',
                  render: (_, s) =>
                    s.bugs.filter((b) => isOpen(b.status)).length,
                },
                {
                  title: 'Health',
                  key: 'health',
                  render: (_, s) => {
                    const health = storyHealth(s);
                    return <Badge value={health}>{healthLabel[health]}</Badge>;
                  },
                },
              ]}
            />
          )}
        </Card>
        <div className="chart-grid">
          <BarChart
            title="Open defects by priority"
            rows={[...priorities].reverse().map((p) => ({
              key: p,
              count: openBugs.filter((b) => b.priority === p).length,
            }))}
          />
          <BarChart
            title="Runs per tester · 14 days"
            rows={
              testers.length
                ? testers.map((u) => ({
                    key: `tester-${u.id}`,
                    name: u.first_name,
                    count: recent.filter((r) => r.tester_id === u.id).length,
                  }))
                : [{ key: 'none', name: 'No runs', count: 0 }]
            }
          />
        </div>
      </div>
      <Card className="card" title="Recent test runs">
        {!runs.data.length ? (
          <Empty description="No tests have been run yet. Open the execution board to start." />
        ) : (
          <Table
            rowKey="id"
            size="middle"
            pagination={false}
            scroll={{ x: 'max-content' }}
            dataSource={runs.data.slice(0, 8)}
            columns={[
              {
                title: 'Date',
                dataIndex: 'executed_on',
                render: (v) => (
                  <Typography.Text type="secondary">{v}</Typography.Text>
                ),
              },
              {
                title: 'Test case',
                key: 'test',
                render: (_, r) => (
                  <Link to={`/test-cases/${r.test_case_id}#run-${r.id}`}>
                    {r.test_case_key} · {r.test_case_title}
                  </Link>
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
                render: (_, r) => fullName(r.tester),
              },
              {
                title: 'Actual result',
                dataIndex: 'actual_result',
                className: 'wrap',
                render: (v) => v || '—',
              },
            ]}
          />
        )}
      </Card>
    </>
  );
}
