'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowUpDown, Plus } from 'lucide-react';
import { useData, useIssues } from '@/hooks/data';
import { priorities, statuses, type Issue, type Project, type Sprint } from '@/types';
import { PageBar, PageBody } from '@/components/layout/page';
import { useCreateIssue } from '@/components/layout/context';
import { Avatar, State } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/controls';
import { Select } from '@/components/ui/select';
import { IssueKey, PriorityLabel, StatusLabel, TypeIcon } from '@/components/ui/glyphs';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import WorkItemFilters, { useFilters } from '@/components/issues/filters';
import BulkActions from '@/components/issues/bulk-actions';

const sorts: Record<string, [string, (a: Issue, b: Issue) => number]> = {
  rank: ['Rank', (a, b) => a.order_index - b.order_index || a.id - b.id],
  updated: ['Recently updated', (a, b) => b.updated_at.localeCompare(a.updated_at)],
  created: ['Newest', (a, b) => b.id - a.id],
  priority: ['Priority', (a, b) => priorities.indexOf(b.priority) - priorities.indexOf(a.priority)],
  status: ['Status', (a, b) => statuses.indexOf(a.status) - statuses.indexOf(b.status)],
  points: ['Story points', (a, b) => b.story_points - a.story_points],
};
const PAGE = 50;

export default function WorkItemsPage() {
  const pid = Number(useParams<{ projectId: string }>().projectId);
  const router = useRouter();
  const project = useData<Project>(`/projects/${pid}`);
  const query = useIssues(pid);
  const sprints = useData<Sprint[]>(`/projects/${pid}/sprints`);
  const create = useCreateIssue();
  const filters = useFilters();
  const [sort, setSort] = useState('rank');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const issues = query.data ?? [];
  const byId = new Map(issues.map((i) => [i.id, i]));
  const shown = issues.filter(filters.matches).sort(sorts[sort][1]);
  const pages = Math.ceil(shown.length / PAGE);
  const rows = shown.slice(page * PAGE, page * PAGE + PAGE);
  const allOnPage = rows.length > 0 && rows.every((i) => selected.has(i.id));
  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <>
      <PageBar
        crumbs={['Work items']}
        projectId={pid}
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => create({ project_id: pid })}>
            Create issue
          </Button>
        }
      />
      <WorkItemFilters
        state={filters}
        fields={['type', 'status', 'priority', 'assignee', 'sprint', 'epic']}
        members={project.data?.members}
        epics={issues.filter((i) => i.issue_type === 'EPIC')}
        sprints={sprints.data}
      >
        <span className="text-xs text-ink-3">
          {shown.length} of {issues.length}
        </span>
        <Select
          size="sm"
          aria-label="Sort by"
          className="w-40"
          value={sort}
          onChange={setSort}
          options={Object.entries(sorts).map(([key, [name]]) => ({ value: key, label: name, icon: <ArrowUpDown className="size-3 text-ink-3" /> }))}
        />
      </WorkItemFilters>
      <BulkActions ids={[...selected]} members={project.data?.members ?? []} sprints={sprints.data ?? []} onDone={() => setSelected(new Set())} />
      <PageBody padded={false}>
        <State loading={query.isLoading} error={query.error} empty={query.data && !shown.length} emptyText={issues.length ? 'No work items match these filters.' : undefined} />
        {!!rows.length && (
          <Table>
            <thead>
              <tr>
                <Th className="w-9">
                  <Checkbox
                    aria-label="Select all on this page"
                    checked={allOnPage ? true : rows.some((i) => selected.has(i.id)) ? 'indeterminate' : false}
                    onChange={(on) => setSelected((s) => {
                      const next = new Set(s);
                      rows.forEach((i) => (on ? next.add(i.id) : next.delete(i.id)));
                      return next;
                    })}
                  />
                </Th>
                <Th className="w-28">Key</Th>
                <Th>Summary</Th>
                <Th className="w-32">Status</Th>
                <Th className="w-28">Priority</Th>
                <Th className="w-40">Assignee</Th>
                <Th className="w-28">Sprint</Th>
                <Th className="w-28">Parent / Epic</Th>
                <Th className="w-16 text-right">Points</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const parent = byId.get(i.parent_issue_id ?? i.epic_id ?? 0);
                return (
                  <Tr key={i.id} selected={selected.has(i.id)} onClick={() => router.push(`/issues/${i.id}`)}>
                    <Td onClick={(e) => e.stopPropagation()}>
                      <Checkbox aria-label={`Select ${i.issue_key}`} checked={selected.has(i.id)} onChange={() => toggle(i.id)} />
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-2">
                        <TypeIcon type={i.issue_type} size={15} />
                        <IssueKey>{i.issue_key}</IssueKey>
                      </span>
                    </Td>
                    <Td className="max-w-0 font-medium">
                      <span className="block truncate">{i.summary}</span>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-2">
                      <StatusLabel status={i.status} />
                    </Td>
                    <Td className="whitespace-nowrap text-ink-2">
                      <PriorityLabel priority={i.priority} />
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <Avatar user={i.assignee} size={20} />
                        {i.assignee ? `${i.assignee.first_name} ${i.assignee.last_name}` : <span className="text-ink-3">Unassigned</span>}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-ink-2">{sprints.data?.find((s) => s.id === i.sprint_id)?.name ?? (i.issue_type === 'EPIC' ? '—' : 'Backlog')}</Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      {parent ? (
                        <Link href={`/issues/${parent.id}`} className="hover:underline">
                          <IssueKey>{parent.issue_key}</IssueKey>
                        </Link>
                      ) : (
                        <span className="text-ink-4">—</span>
                      )}
                    </Td>
                    <Td className="tnum text-right">{i.story_points}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between px-[18px] py-3 text-xs text-ink-3">
            <span>
              {page * PAGE + 1}–{Math.min(shown.length, page * PAGE + PAGE)} of {shown.length}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" disabled={!page} onClick={() => setPage(page - 1)}>
                Prev
              </Button>
              <span>
                Page {page + 1} / {pages}
              </span>
              <Button size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
