import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, Empty, Input, Table, Typography } from 'antd';
import { BugOutlined } from '@ant-design/icons';
import { useData, useSave } from '../hooks/data';
import {
  label,
  priorities,
  statuses,
  type Execution,
  type Issue,
  type Project,
  type TestCase,
} from '../types';
import { fullName, isOpen } from '../lib/qa';
import { PageHeader, State } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import { Select, labelled } from '../components/ui/form';
import { BarChart, Kpi } from '../components/ui/charts';
import { useCreateIssue } from '../components/layout/AppShell';

function StatusSelect({ bug }: { bug: Issue }) {
  const save = useSave(`/issues/${bug.id}/status`, 'patch', 'Bug updated');
  return (
    <Select
      className="card-status"
      size="small"
      aria-label={`Status for ${bug.issue_key}`}
      value={bug.status}
      disabled={save.isPending}
      onChange={(v) => save.mutate({ status: v })}
      options={labelled(statuses)}
      popupMatchSelectWidth={false}
    />
  );
}

export default function BugsPage() {
  const pid = Number(useParams().projectId);
  const project = useData<Project>(`/projects/${pid}`);
  const issues = useData<Issue[]>(`/issues?project_id=${pid}`);
  const tests = useData<TestCase[]>(`/test-cases?project_id=${pid}`);
  const runs = useData<Execution[]>(`/test-executions?project_id=${pid}`);
  const create = useCreateIssue();
  const [state, setState] = useState('OPEN');
  const [priority, setPriority] = useState('');
  const [assignee, setAssignee] = useState('');
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const all = issues.data ?? [];
  const bugs = all.filter((i) => i.issue_type === 'BUG');
  const open = bugs.filter((b) => isOpen(b.status));
  const shown = bugs
    .filter(
      (b) =>
        (state === 'ALL' ||
          (state === 'OPEN' ? isOpen(b.status) : b.status === state)) &&
        (!priority || b.priority === priority) &&
        (!assignee || String(b.assignee_id ?? 'none') === assignee) &&
        (!source || (source === 'test') === !!b.related_test_case_id) &&
        (!search ||
          `${b.issue_key} ${b.summary}`
            .toLowerCase()
            .includes(search.toLowerCase())),
    )
    .sort(
      (a, b) =>
        priorities.indexOf(b.priority) - priorities.indexOf(a.priority) ||
        b.updated_at.localeCompare(a.updated_at),
    );
  const fromTests = bugs.filter((b) => b.related_test_case_id).length;
  return (
    <>
      <PageHeader
        title="Bug Tracking"
        description="Defects found in testing, linked to the story and test that exposed them."
      >
        <Button
          icon={<BugOutlined />}
          onClick={() =>
            create({ project_id: pid, issue_type: 'BUG', priority: 'HIGH' })
          }
        >
          Report bug
        </Button>
      </PageHeader>
      <State loading={issues.isLoading} error={issues.error} />
      <div className="kpis">
        <Kpi
          name="Open bugs"
          value={open.length}
          tone={open.length ? 'warn' : 'good'}
        />
        <Kpi
          name="Critical open"
          value={open.filter((b) => b.priority === 'CRITICAL').length}
          tone={open.some((b) => b.priority === 'CRITICAL') ? 'bad' : 'good'}
        />
        <Kpi
          name="Fixed"
          value={bugs.length - open.length}
          hint={`of ${bugs.length} reported`}
        />
        <Kpi
          name="Found by tests"
          value={fromTests}
          hint={`${bugs.length - fromTests} reported directly`}
        />
      </div>
      <div className="dashboard-detail">
        <Card className="card">
          <div className="filters">
            <Input.Search
              allowClear
              aria-label="Search bugs"
              placeholder="Search bugs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              aria-label="Filter by status"
              value={state}
              onChange={setState}
              options={[
                { value: 'OPEN', label: 'Open' },
                { value: 'ALL', label: 'All statuses' },
                ...labelled(statuses),
              ]}
            />
            <Select
              aria-label="Filter by priority"
              value={priority}
              onChange={setPriority}
              options={[
                { value: '', label: 'All priorities' },
                ...labelled(priorities),
              ]}
            />
            <Select
              aria-label="Filter by assignee"
              value={assignee}
              onChange={setAssignee}
              options={[
                { value: '', label: 'Anyone' },
                { value: 'none', label: 'Unassigned' },
                ...(project.data?.members ?? []).map((u) => ({
                  value: u.id,
                  label: fullName(u),
                })),
              ]}
            />
            <Select
              aria-label="Filter by source"
              value={source}
              onChange={setSource}
              options={[
                { value: '', label: 'Any source' },
                { value: 'test', label: 'Found by a test' },
                { value: 'direct', label: 'Reported directly' },
              ]}
            />
          </div>
          {!issues.isLoading && !shown.length ? (
            <Empty
              description={
                bugs.length
                  ? 'No bugs match these filters.'
                  : 'No bugs reported. Failed test runs can log one in a click.'
              }
            />
          ) : (
            <Table
              rowKey="id"
              size="middle"
              loading={issues.isLoading}
              dataSource={shown}
              scroll={{ x: 'max-content' }}
              pagination={{ pageSize: 25, hideOnSinglePage: true }}
              columns={[
                {
                  title: 'Key',
                  dataIndex: 'issue_key',
                  render: (key, b) => <Link to={`/issues/${b.id}`}>{key}</Link>,
                },
                {
                  title: 'Summary',
                  dataIndex: 'summary',
                  render: (summary, b) => (
                    <Link className="summary-link" to={`/issues/${b.id}`}>
                      {summary}
                    </Link>
                  ),
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
                  title: 'Status',
                  key: 'status',
                  render: (_, b) => <StatusSelect bug={b} />,
                },
                {
                  title: 'Assignee',
                  key: 'assignee',
                  render: (_, b) => fullName(b.assignee),
                },
                {
                  title: 'Story',
                  key: 'story',
                  render: (_, b) => {
                    const story = all.find((i) => i.id === b.related_issue_id);
                    return story ? (
                      <Link to={`/issues/${story.id}`} title={story.summary}>
                        {story.issue_key}
                      </Link>
                    ) : (
                      '—'
                    );
                  },
                },
                {
                  title: 'Found by',
                  key: 'found',
                  render: (_, b) => {
                    const test = tests.data?.find(
                      (t) => t.id === b.related_test_case_id,
                    );
                    const run = runs.data?.find(
                      (r) => r.id === b.related_execution_id,
                    );
                    return test ? (
                      <Link
                        to={`/test-cases/${test.id}${run ? `#run-${run.id}` : ''}`}
                        title={test.title}
                      >
                        {test.test_case_key}
                        {run && ` · run ${run.executed_on}`}
                      </Link>
                    ) : (
                      'Reported'
                    );
                  },
                },
              ]}
            />
          )}
        </Card>
        <div className="chart-grid">
          <BarChart
            title="Open bugs by priority"
            rows={[...priorities].reverse().map((p) => ({
              key: p,
              count: open.filter((b) => b.priority === p).length,
            }))}
          />
          <BarChart
            title="Bugs by status"
            rows={statuses.map((s) => ({
              key: s,
              count: bugs.filter((b) => b.status === s).length,
            }))}
          />
        </div>
      </div>
    </>
  );
}
