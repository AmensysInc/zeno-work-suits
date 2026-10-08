import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import { useData, useIssues, useSave } from '../hooks/data';
import { type Issue, type Sprint, statuses, priorities, label } from '../types';
import { State, Badge, Field } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import TestCaseList from '../components/testing/TestCaseList';
import Comments from '../components/issues/Comments';
import ActivityHistory from '../components/issues/ActivityHistory';
import AcceptanceCriteria from '../components/issues/AcceptanceCriteria';
import IssueTable from '../components/issues/IssueTable';
import { useCreateIssue } from '../components/layout/AppShell';
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
  const [tab, setTab] = useState('Overview');
  if (!issue) return <State loading={query.isLoading} error={query.error} />;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="key">
            {issue.issue_key} · {issue.issue_type}
          </p>
          <h1>{issue.summary}</h1>
        </div>
        <div className="actions">
          <Button variant="outline" onClick={() => create(issue)}>
            Edit issue
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              if (
                window.confirm(
                  'Delete this issue and its criteria, tests and comments?',
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
        </div>
      </div>
      <div className="detail-grid">
        <div>
          <div className="tabs">
            {['Overview', 'Subtasks', 'Test Cases', 'Comments', 'Activity'].map(
              (t) => (
                <button
                  key={t}
                  className={tab === t ? 'selected' : ''}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ),
            )}
          </div>
          {tab === 'Comments' ? (
            <Comments issueId={issue.id} />
          ) : tab === 'Activity' ? (
            <ActivityHistory issueId={issue.id} />
          ) : tab === 'Test Cases' ? (
            <TestCaseList issueId={issue.id} />
          ) : tab === 'Overview' ? (
            <>
              <section className="card">
                <h2>Description</h2>
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
              </section>
              {issue.issue_type === 'STORY' && (
                <AcceptanceCriteria issueId={issue.id} />
              )}
            </>
          ) : (
            <section className="card">
              <div className="section-head">
                <h2>Subtasks</h2>
                <Button
                  onClick={() =>
                    create({
                      project_id: issue.project_id,
                      issue_type: 'SUBTASK',
                      parent_issue_id: issue.id,
                      epic_id: issue.epic_id,
                    })
                  }
                >
                  + Add subtask
                </Button>
              </div>
              <IssueTable
                issues={
                  all.data?.filter((i) => i.parent_issue_id === issue.id) ?? []
                }
              />
            </section>
          )}
        </div>
        <aside className="card details-panel">
          <h2>Details</h2>
          <Field label="Status">
            <select
              value={issue.status}
              disabled={save.isPending}
              onChange={(e) => save.mutate({ status: e.target.value })}
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select
              value={issue.priority}
              disabled={save.isPending}
              onChange={(e) => save.mutate({ priority: e.target.value })}
            >
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {label(p)}
                </option>
              ))}
            </select>
          </Field>
          <dl>
            <dt>Assignee</dt>
            <dd>
              {issue.assignee
                ? `${issue.assignee.first_name} ${issue.assignee.last_name}`
                : 'Unassigned'}
            </dd>
            <dt>Reporter</dt>
            <dd>
              {issue.reporter.first_name} {issue.reporter.last_name}
            </dd>
            <dt>Epic</dt>
            <dd>
              {all.data?.find((i) => i.id === issue.epic_id)?.summary ?? 'None'}
            </dd>
            <dt>Sprint</dt>
            <dd>
              {sprints.data?.find((s) => s.id === issue.sprint_id)?.name ??
                'Backlog'}
            </dd>
            <dt>Story points</dt>
            <dd>{issue.story_points}</dd>
            <dt>Created</dt>
            <dd>{new Date(issue.created_at).toLocaleDateString()}</dd>
          </dl>
          <Field label="Due date">
            <input
              type="date"
              value={issue.due_date ?? ''}
              onChange={(e) =>
                save.mutate({ due_date: e.target.value || null })
              }
            />
          </Field>
          {issue.related_issue_id && (
            <Link to={`/issues/${issue.related_issue_id}`}>
              View linked story →
            </Link>
          )}
          {issue.related_test_case_id && (
            <p>
              <Link to={`/test-cases/${issue.related_test_case_id}`}>
                View linked test →
              </Link>
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
