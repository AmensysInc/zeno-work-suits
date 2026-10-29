import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import { Card, Descriptions, Tabs, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useCanLead, useData, useIssues, useSave } from '../hooks/data';
import {
  type Issue,
  type Sprint,
  type TestCase,
  statuses,
  priorities,
} from '../types';
import { State, Badge, Field } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import { DateInput, Select, labelled } from '../components/ui/form';
import { confirm } from '../components/ui/confirm';
import TestCaseList from '../components/testing/TestCaseList';
import Comments from '../components/issues/Comments';
import ActivityHistory from '../components/issues/ActivityHistory';
import AcceptanceCriteria from '../components/issues/AcceptanceCriteria';
import IssueTable from '../components/issues/IssueTable';
import { useCreateIssue, usePageProject } from '../components/layout/AppShell';
export default function IssueDetailsPage() {
  const { issueId } = useParams();
  const query = useData<Issue>(`/issues/${issueId}`);
  const issue = query.data;
  const all = useIssues(issue?.project_id);
  const sprints = useData<Sprint[]>(
    `/projects/${issue?.project_id}/sprints`,
    !!issue,
  );
  const save = useSave(`/issues/${issueId}`, 'put');
  const del = useSave(`/issues/${issueId}`, 'delete', 'Issue deleted');
  const create = useCreateIssue();
  const nav = useNavigate();
  const canLead = useCanLead(issue?.project_id);
  const tests = useData<TestCase[]>(
    `/test-cases?issue_id=${issueId}`,
    canLead && issue?.issue_type === 'STORY',
  );
  const [tab, setTab] = useState('Overview');
  usePageProject(issue?.project_id);
  if (!issue) return <State loading={query.isLoading} error={query.error} />;
  const epic = issue.issue_type === 'EPIC';
  const childTab = epic ? 'Child issues' : 'Subtasks';
  return (
    <>
      <div className="page-heading">
        <div>
          <Typography.Text type="secondary" className="key">
            {issue.issue_key} · <Badge value={issue.issue_type} />
          </Typography.Text>
          <Typography.Title level={3}>{issue.summary}</Typography.Title>
          {issue.ai_source?.source_commit && (
            <p className="muted">
              Generated from {issue.ai_source.repository}
              {issue.ai_source.module_path
                ? ` / ${issue.ai_source.module_path}`
                : ''}{' '}
              @{issue.ai_source.source_commit.slice(0, 7)}
            </p>
          )}
        </div>
        <div className="actions">
          <Button
            variant="outline"
            icon={<EditOutlined />}
            onClick={() => create(issue)}
          >
            Edit issue
          </Button>
          {canLead && (
          <Button
            variant="destructive"
            icon={<DeleteOutlined />}
            onClick={async () => {
              const subtasks =
                all.data?.filter((i) => i.parent_issue_id === issue.id)
                  .length ?? 0;
              const runs = (tests.data ?? []).reduce(
                (n, t) => n + t.execution_count,
                0,
              );
              const lost = [
                subtasks && `${subtasks} subtask${subtasks === 1 ? '' : 's'}`,
                tests.data?.length &&
                  `${tests.data.length} test case${tests.data.length === 1 ? '' : 's'} with ${runs} recorded run${runs === 1 ? '' : 's'}`,
              ].filter(Boolean);
              if (
                await confirm(
                  `Delete ${issue.issue_key} with its criteria and comments${
                    lost.length ? `, ${lost.join(' and ')}` : ''
                  }? This cannot be undone.`,
                  { okText: 'Delete' },
                )
              ) {
                try {
                  await del.mutateAsync({});
                  nav(`/projects/${issue.project_id}/backlog`);
                } catch {
                  /*toast*/
                }
              }
            }}
          >
            Delete
          </Button>
          )}
        </div>
      </div>
      <div className="detail-grid">
        <div>
          <Tabs
            activeKey={tab}
            onChange={setTab}
            items={[
              'Overview',
              childTab,
              'Test Cases',
              'Comments',
              'Activity',
            ].map((t) => ({ key: t, label: t }))}
          />
          {tab === 'Comments' ? (
            <Comments issueId={issue.id} projectId={issue.project_id} />
          ) : tab === 'Activity' ? (
            <ActivityHistory issueId={issue.id} />
          ) : tab === 'Test Cases' ? (
            <TestCaseList issueId={issue.id} />
          ) : tab === 'Overview' ? (
            <>
              <Card className="card" title="Description">
                <div className="markdown">
                  <Markdown>
                    {issue.description || 'No description yet.'}
                  </Markdown>
                </div>
                {issue.labels.length > 0 && (
                  <div className="actions">
                    {issue.labels.map((l) => (
                      <Badge value={l} key={l} />
                    ))}
                  </div>
                )}
              </Card>
              {issue.issue_type === 'STORY' && (
                <AcceptanceCriteria issueId={issue.id} />
              )}
            </>
          ) : (
            <Card
              className="card"
              title={childTab}
              extra={
                <Button
                  icon={<PlusOutlined />}
                  onClick={() =>
                    create(
                      epic
                        ? {
                            project_id: issue.project_id,
                            issue_type: 'STORY',
                            epic_id: issue.id,
                          }
                        : {
                            project_id: issue.project_id,
                            issue_type: 'SUBTASK',
                            parent_issue_id: issue.id,
                            epic_id: issue.epic_id,
                          },
                    )
                  }
                >
                  {epic ? 'Add child issue' : 'Add subtask'}
                </Button>
              }
            >
              <IssueTable
                issues={
                  all.data?.filter((i) =>
                    epic
                      ? i.epic_id === issue.id
                      : i.parent_issue_id === issue.id,
                  ) ?? []
                }
              />
            </Card>
          )}
        </div>
        <Card className="card details-panel" title="Details">
          <Field label="Status">
            <Select
              value={issue.status}
              disabled={save.isPending}
              onChange={(v) => save.mutate({ status: v })}
              options={labelled(statuses)}
            />
          </Field>
          <Field label="Priority">
            <Select
              value={issue.priority}
              disabled={save.isPending}
              onChange={(v) => save.mutate({ priority: v })}
              options={labelled(priorities)}
            />
          </Field>
          <Descriptions
            column={1}
            size="small"
            className="details-list"
            items={[
              {
                label: 'Assignee',
                children: issue.assignee
                  ? `${issue.assignee.first_name} ${issue.assignee.last_name}`
                  : 'Unassigned',
              },
              {
                label: 'Reporter',
                children: `${issue.reporter.first_name} ${issue.reporter.last_name}`,
              },
              {
                label: 'Epic',
                children:
                  all.data?.find((i) => i.id === issue.epic_id)?.summary ??
                  'None',
              },
              {
                label: 'Sprint',
                children:
                  sprints.data?.find((s) => s.id === issue.sprint_id)?.name ??
                  'Backlog',
              },
              { label: 'Story points', children: issue.story_points },
              {
                label: 'Created',
                children: new Date(issue.created_at).toLocaleDateString(),
              },
            ]}
          />
          <Field label="Due date">
            <DateInput
              value={issue.due_date}
              onChange={(v) => save.mutate({ due_date: v || null })}
            />
          </Field>
          {issue.related_issue_id && (
            <Link to={`/issues/${issue.related_issue_id}`}>
              View linked story →
            </Link>
          )}
          {issue.related_test_case_id && (
            <p>
              <Link
                to={`/test-cases/${issue.related_test_case_id}${issue.related_execution_id ? `#run-${issue.related_execution_id}` : ''}`}
              >
                {issue.related_execution_id
                  ? 'View failed test run →'
                  : 'View linked test →'}
              </Link>
            </p>
          )}
          {issue.issue_type === 'STORY' && (
            <p>
              <Link
                to={`/projects/${issue.project_id}/traceability?story=${issue.id}`}
              >
                View traceability →
              </Link>
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
