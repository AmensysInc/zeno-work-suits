'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Markdown from 'react-markdown';
import { Calendar, Pencil, Plus, Sparkles, Timer, Trash2 } from 'lucide-react';
import { useCanLead, useData, useIssues, useSave } from '@/hooks/data';
import { label, priorities, statuses, type Issue, type Sprint, type TestCase } from '@/types';
import { PageBar } from '@/components/layout/page';
import { useCreateIssue, usePageProject } from '@/components/layout/context';
import { Avatar, State, Tag, projectColor } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/controls';
import { IssueKey, PriorityIcon, StatusIcon, TypeIcon } from '@/components/ui/glyphs';
import { confirm } from '@/components/ui/confirm';
import AcceptanceCriteria from '@/components/issues/acceptance-criteria';
import ActivityHistory from '@/components/issues/activity-history';
import Comments from '@/components/issues/comments';
import IssueList from '@/components/issues/issue-list';
import TestCaseList from '@/components/testing/test-case-list';

function Prop({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[34px] items-center gap-2.5">
      <span className="w-24 shrink-0 text-[12.5px] text-ink-3">{name}</span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[12.5px]">{children}</div>
    </div>
  );
}

type Tab = 'overview' | 'children' | 'tests' | 'comments' | 'activity';

export default function IssueDetailsPage() {
  const issueId = useParams<{ issueId: string }>().issueId;
  const router = useRouter();
  const query = useData<Issue>(`/issues/${issueId}`);
  const issue = query.data;
  const all = useIssues(issue?.project_id);
  const sprints = useData<Sprint[]>(`/projects/${issue?.project_id}/sprints`, !!issue);
  const save = useSave(`/issues/${issueId}`, 'put');
  const del = useSave(`/issues/${issueId}`, 'delete', 'Issue deleted');
  const create = useCreateIssue();
  const canLead = useCanLead(issue?.project_id);
  const tests = useData<TestCase[]>(`/test-cases?issue_id=${issueId}`, canLead && issue?.issue_type === 'STORY');
  const [tab, setTab] = useState<Tab>('overview');
  usePageProject(issue?.project_id);
  if (!issue)
    return (
      <>
        <PageBar crumbs={['Issue']} />
        <State loading={query.isLoading} error={query.error} />
      </>
    );
  const epic = issue.issue_type === 'EPIC';
  const children = all.data?.filter((i) => (epic ? i.epic_id === issue.id : i.parent_issue_id === issue.id)) ?? [];
  const epicIssue = all.data?.find((i) => i.id === issue.epic_id);
  const remove = async () => {
    const subtasks = all.data?.filter((i) => i.parent_issue_id === issue.id).length ?? 0;
    const runs = (tests.data ?? []).reduce((n, t) => n + t.execution_count, 0);
    const lost = [
      subtasks && `${subtasks} subtask${subtasks === 1 ? '' : 's'}`,
      tests.data?.length && `${tests.data.length} test case${tests.data.length === 1 ? '' : 's'} with ${runs} recorded run${runs === 1 ? '' : 's'}`,
    ].filter(Boolean);
    if (await confirm(`Delete ${issue.issue_key} with its criteria and comments${lost.length ? `, ${lost.join(' and ')}` : ''}? This cannot be undone.`, { okText: 'Delete' })) {
      try {
        await del.mutateAsync({});
        router.push(`/projects/${issue.project_id}/backlog`);
      } catch {
        /* toast */
      }
    }
  };
  const addChild = () =>
    create(
      epic
        ? { project_id: issue.project_id, issue_type: 'STORY', epic_id: issue.id }
        : { project_id: issue.project_id, issue_type: 'SUBTASK', parent_issue_id: issue.id, epic_id: issue.epic_id },
    );
  return (
    <>
      <PageBar
        crumbs={[{ label: 'Backlog', href: `/projects/${issue.project_id}/backlog` }, issue.issue_key]}
        projectId={issue.project_id}
        actions={
          <>
            <Button icon={<Pencil />} onClick={() => create(issue)}>
              Edit issue
            </Button>
            {canLead && (
              <Button variant="danger" icon={<Trash2 />} onClick={remove} loading={del.isPending}>
                <span className="hidden sm:inline">Delete</span>
              </Button>
            )}
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div className="scrollbar-thin flex min-w-0 flex-1 flex-col gap-5 px-4 py-5 sm:px-8 lg:overflow-y-auto">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <TypeIcon type={issue.issue_type} size={18} />
              <IssueKey>{issue.issue_key}</IssueKey>
              {epicIssue && (
                <Link href={`/issues/${epicIssue.id}`}>
                  <Tag color="#7c3aed">{epicIssue.summary}</Tag>
                </Link>
              )}
              {issue.ai_source?.source_commit && (
                <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-3">
                  <Sparkles className="size-3" />
                  Generated from {issue.ai_source.repository}
                  {issue.ai_source.module_path ? ` / ${issue.ai_source.module_path}` : ''} @{issue.ai_source.source_commit.slice(0, 7)}
                </span>
              )}
            </div>
            <h1 className="text-[24px] font-semibold leading-tight tracking-tight">{issue.summary}</h1>
          </div>
          <Tabs<Tab>
            className="-mt-1 px-0"
            value={tab}
            onChange={setTab}
            items={[
              { key: 'overview', label: 'Overview' },
              { key: 'children', label: epic ? 'Child issues' : 'Subtasks', count: children.length },
              { key: 'tests', label: 'Test cases' },
              { key: 'comments', label: 'Comments' },
              { key: 'activity', label: 'Activity' },
            ]}
          />
          {tab === 'overview' && (
            <>
              <div className="flex flex-col gap-2">
                <span className="caps">Description</span>
                <div className="prose-sm max-w-none text-[14px] leading-relaxed text-ink [&_a]:text-accent-ink [&_code]:rounded [&_code]:bg-hover [&_code]:px-1 [&_li]:my-0.5 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:ml-5 [&_ul]:list-disc">
                  <Markdown>{issue.description || '_No description yet._'}</Markdown>
                </div>
                {issue.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {issue.labels.map((l) => (
                      <Tag key={l} color={projectColor(l.length * 7)}>
                        {l}
                      </Tag>
                    ))}
                  </div>
                )}
              </div>
              {issue.issue_type === 'STORY' && <AcceptanceCriteria issueId={issue.id} />}
            </>
          )}
          {tab === 'children' && (
            <div className="overflow-hidden rounded-lg border border-line">
              <div className="flex items-center justify-between border-b border-line bg-subtle px-4 py-2">
                <span className="text-[13px] font-semibold">{epic ? 'Child issues' : 'Subtasks'}</span>
                <Button size="sm" icon={<Plus />} onClick={addChild}>
                  {epic ? 'Add child issue' : 'Add subtask'}
                </Button>
              </div>
              <IssueList issues={children} />
            </div>
          )}
          {tab === 'tests' && <TestCaseList issueId={issue.id} />}
          {tab === 'comments' && <Comments issueId={issue.id} projectId={issue.project_id} />}
          {tab === 'activity' && <ActivityHistory issueId={issue.id} />}
        </div>

        <aside className="flex shrink-0 flex-col gap-1 border-t border-line bg-subtle px-4 py-4 sm:px-[18px] lg:w-[312px] lg:overflow-y-auto lg:border-l lg:border-t-0">
          <Select
            aria-label="Status"
            size="lg"
            className="mb-2 w-full font-semibold"
            value={issue.status}
            disabled={save.isPending}
            onChange={(v) => save.mutate({ status: v })}
            options={statuses.map((s) => ({ value: s, label: label(s), icon: <StatusIcon status={s} /> }))}
          />
          <Prop name="Priority">
            <Select
              aria-label="Priority"
              size="sm"
              className="w-full border-transparent shadow-none hover:border-line-2"
              value={issue.priority}
              disabled={save.isPending}
              onChange={(v) => save.mutate({ priority: v })}
              options={priorities.map((p) => ({ value: p, label: label(p), icon: <PriorityIcon priority={p} /> }))}
            />
          </Prop>
          <Prop name="Assignee">
            <Avatar user={issue.assignee} size={20} />
            {issue.assignee ? `${issue.assignee.first_name} ${issue.assignee.last_name}` : <span className="text-ink-3">Unassigned</span>}
          </Prop>
          <Prop name="Reporter">
            <Avatar user={issue.reporter} size={20} />
            {issue.reporter.first_name} {issue.reporter.last_name}
          </Prop>
          <Prop name="Epic">{epicIssue ? epicIssue.summary : <span className="text-ink-3">None</span>}</Prop>
          <Prop name="Sprint">
            <Timer className="size-3.5 text-ink-3" />
            {sprints.data?.find((s) => s.id === issue.sprint_id)?.name ?? 'Backlog'}
          </Prop>
          <Prop name="Story points">
            <b className="tnum font-semibold">{issue.story_points}</b>
          </Prop>
          <Prop name="Due date">
            <Input
              type="date"
              size="sm"
              aria-label="Due date"
              className="w-full"
              icon={<Calendar />}
              value={issue.due_date ?? ''}
              onChange={(e) => save.mutate({ due_date: e.target.value || null })}
            />
          </Prop>
          <div className="my-2 h-px bg-line" />
          <Prop name="Created">
            <span className="text-ink-2">{new Date(issue.created_at).toLocaleDateString()}</span>
          </Prop>
          <Prop name="Updated">
            <span className="text-ink-2">{new Date(issue.updated_at).toLocaleString()}</span>
          </Prop>
          <div className="my-2 h-px bg-line" />
          <div className="flex flex-col gap-1.5 text-[12.5px]">
            {issue.related_issue_id && (
              <Link href={`/issues/${issue.related_issue_id}`} className="font-medium text-accent-ink hover:underline">
                View linked story →
              </Link>
            )}
            {issue.related_test_case_id && (
              <Link
                href={`/test-cases/${issue.related_test_case_id}${issue.related_execution_id ? `#run-${issue.related_execution_id}` : ''}`}
                className="font-medium text-accent-ink hover:underline"
              >
                {issue.related_execution_id ? 'View failed test run →' : 'View linked test →'}
              </Link>
            )}
            {issue.issue_type === 'STORY' && (
              <Link href={`/projects/${issue.project_id}/traceability?story=${issue.id}`} className="font-medium text-accent-ink hover:underline">
                View traceability →
              </Link>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
