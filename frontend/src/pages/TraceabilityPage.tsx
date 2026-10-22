import { useState } from 'react';
import { Card, Checkbox, Empty, Table, Tag, Typography } from 'antd';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useData } from '../hooks/data';
import {
  label,
  type Sprint,
  type Traceability,
  type TraceStory,
} from '../types';
import { fullName, healthLabel, isOpen, percent, storyHealth } from '../lib/qa';
import { PageHeader, State, Badge } from '../components/ui/shared';
import { Kpi } from '../components/ui/charts';
import { Select } from '../components/ui/form';

const chipColors: Record<string, string> = {
  PASSED: 'success',
  FAILED: 'error',
  BLOCKED: 'warning',
};

function TestChip({ test }: { test: TraceStory['test_cases'][number] }) {
  return (
    <Link
      to={`/test-cases/${test.id}`}
      title={`${test.title} · ${label(test.status)}${test.last_execution ? ` · ${test.last_execution.executed_on} by ${fullName(test.last_execution.tester)}` : ''}`}
    >
      <Tag color={chipColors[test.status]}>{test.test_case_key}</Tag>
    </Link>
  );
}

function Detail({ story }: { story: TraceStory }) {
  const unlinked = story.test_cases.filter((t) => !t.criterion_ids.length);
  return (
    <div className="trace-detail">
      <div>
        <Typography.Title level={5}>
          Acceptance criteria → tests → results
        </Typography.Title>
        {!story.criteria.length && (
          <p className="warn">
            No acceptance criteria. Add them on the story to measure coverage.
          </p>
        )}
        <ol className="trace-criteria">
          {story.criteria.map((c) => (
            <li key={c.id}>
              <span className={c.completed ? 'checked' : ''}>
                {c.description}
              </span>
              <span className="chips">
                {c.test_case_ids.length ? (
                  story.test_cases
                    .filter((t) => c.test_case_ids.includes(t.id))
                    .map((t) => <TestChip key={t.id} test={t} />)
                ) : (
                  <Badge value="GAP">No test</Badge>
                )}
              </span>
            </li>
          ))}
        </ol>
        {!!unlinked.length && (
          <p className="muted">
            Not linked to a criterion:{' '}
            {unlinked.map((t) => (
              <TestChip key={t.id} test={t} />
            ))}
          </p>
        )}
      </div>
      <div>
        <Typography.Title level={5}>Development</Typography.Title>
        {story.subtasks.length ? (
          <ul className="trace-list">
            {story.subtasks.map((s) => (
              <li key={s.id}>
                <Link to={`/issues/${s.id}`}>{s.issue_key}</Link> {s.summary}{' '}
                <Badge value={s.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No development subtasks.</p>
        )}
        <Typography.Title level={5} className="spaced">
          Defects
        </Typography.Title>
        {story.bugs.length ? (
          <ul className="trace-list">
            {story.bugs.map((b) => {
              const test = story.test_cases.find(
                (t) => t.id === b.related_test_case_id,
              );
              return (
                <li key={b.id}>
                  <Link to={`/issues/${b.id}`}>{b.issue_key}</Link> {b.summary}{' '}
                  <Badge value={b.status} />
                  {test && (
                    <span className="muted"> · from {test.test_case_key}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">No defects linked.</p>
        )}
      </div>
    </div>
  );
}

export default function TraceabilityPage() {
  const pid = Number(useParams().projectId);
  const [params] = useSearchParams();
  const query = useData<Traceability>(`/projects/${pid}/traceability`);
  const sprints = useData<Sprint[]>(`/projects/${pid}/sprints`);
  const [epic, setEpic] = useState(0);
  const [sprint, setSprint] = useState(0);
  const [gapsOnly, setGapsOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set([Number(params.get('story'))].filter(Boolean)),
  );
  const data = query.data;
  if (!data) return <State loading={query.isLoading} error={query.error} />;
  const stories = data.stories.filter(
    (s) =>
      (!epic || s.epic_id === epic) &&
      (!sprint || s.sprint_id === sprint) &&
      (!gapsOnly || storyHealth(s) !== 'READY'),
  );
  const criteria = data.stories.flatMap((s) => s.criteria);
  const tests = data.stories.flatMap((s) => s.test_cases);
  const bugs = data.stories.flatMap((s) => s.bugs);
  const toggle = (id: number) =>
    setExpanded((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    <>
      <PageHeader
        title="Traceability Matrix"
        description="Follow each requirement through development, testing and defects."
      />
      <div className="kpis">
        <Kpi
          name="Stories with tests"
          value={`${percent(data.stories.filter((s) => s.test_cases.length).length, data.stories.length)}%`}
          hint={`${data.stories.length} stories`}
        />
        <Kpi
          name="Criteria covered"
          value={`${percent(criteria.filter((c) => c.test_case_ids.length).length, criteria.length)}%`}
          hint={`${criteria.filter((c) => !c.test_case_ids.length).length} without a test`}
        />
        <Kpi
          name="Tests passing"
          value={`${percent(tests.filter((t) => t.status === 'PASSED').length, tests.length)}%`}
          hint={`${tests.length} tests`}
        />
        <Kpi
          name="Open defects"
          value={bugs.filter((b) => isOpen(b.status)).length}
          tone={bugs.some((b) => isOpen(b.status)) ? 'warn' : 'good'}
        />
      </div>
      <Card className="card">
        <div className="filters">
          <Select
            aria-label="Filter by epic"
            value={epic}
            onChange={(v) => setEpic(Number(v))}
            options={[
              { value: 0, label: 'All epics' },
              ...data.epics.map((e) => ({
                value: e.id,
                label: `${e.issue_key} — ${e.summary}`,
              })),
            ]}
          />
          <Select
            aria-label="Filter by sprint"
            value={sprint}
            onChange={(v) => setSprint(Number(v))}
            options={[
              { value: 0, label: 'All sprints' },
              ...(sprints.data ?? []).map((s) => ({
                value: s.id,
                label: s.name,
              })),
            ]}
          />
          <Checkbox
            className="check-row"
            checked={gapsOnly}
            onChange={(e) => setGapsOnly(e.target.checked)}
          >
            Only stories that need attention
          </Checkbox>
        </div>
        {!stories.length ? (
          <Empty
            description={
              data.stories.length
                ? 'Every story matching these filters is ready.'
                : 'No user stories yet.'
            }
          />
        ) : (
          <Table
            className="trace-table"
            rowKey="id"
            size="middle"
            pagination={false}
            scroll={{ x: 'max-content' }}
            dataSource={stories}
            expandable={{
              expandedRowKeys: [...expanded],
              onExpand: (_, s) => toggle(s.id),
              expandedRowRender: (s) => <Detail story={s} />,
            }}
            columns={[
              {
                title: 'Story',
                dataIndex: 'issue_key',
                render: (key, s) => <Link to={`/issues/${s.id}`}>{key}</Link>,
              },
              {
                title: 'Requirement',
                dataIndex: 'summary',
                render: (summary, s) => (
                  <>
                    <Link className="summary-link" to={`/issues/${s.id}`}>
                      {summary}
                    </Link>
                    <div className="muted">
                      {label(s.priority)} · {fullName(s.assignee)}
                    </div>
                  </>
                ),
              },
              {
                title: 'Development',
                key: 'dev',
                render: (_, s) => {
                  const done = s.subtasks.filter(
                    (t) => t.status === 'DONE',
                  ).length;
                  return (
                    <>
                      <Badge value={s.status} />
                      <div className="muted">
                        {s.subtasks.length
                          ? `${done}/${s.subtasks.length} subtasks done`
                          : 'No subtasks'}
                      </div>
                    </>
                  );
                },
              },
              {
                title: 'Criteria covered',
                key: 'criteria',
                render: (_, s) => {
                  const covered = s.criteria.filter(
                    (c) => c.test_case_ids.length,
                  ).length;
                  return (
                    <Typography.Text
                      type={
                        covered < s.criteria.length || !s.criteria.length
                          ? 'warning'
                          : 'secondary'
                      }
                    >
                      {s.criteria.length
                        ? `${covered}/${s.criteria.length}`
                        : 'None defined'}
                    </Typography.Text>
                  );
                },
              },
              {
                title: 'Tests · latest result',
                key: 'tests',
                className: 'wrap',
                render: (_, s) => (
                  <span className="chips">
                    {s.test_cases.length ? (
                      s.test_cases.map((t) => <TestChip key={t.id} test={t} />)
                    ) : (
                      <Typography.Text type="warning">No tests</Typography.Text>
                    )}
                  </span>
                ),
              },
              {
                title: 'Defects',
                key: 'bugs',
                render: (_, s) => {
                  const openBugs = s.bugs.filter((b) => isOpen(b.status));
                  return s.bugs.length ? (
                    <Typography.Text
                      type={openBugs.length ? 'danger' : 'secondary'}
                    >
                      {openBugs.length} open / {s.bugs.length}
                    </Typography.Text>
                  ) : (
                    <Typography.Text type="secondary">—</Typography.Text>
                  );
                },
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
    </>
  );
}
