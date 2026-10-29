'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProjects } from '@/hooks/data';
import type { Issue, Sprint } from '@/types';
import { Avatar, Empty, Tag, projectColor } from '@/components/ui/display';
import { IssueKey, Points, PriorityIcon, StatusIcon, StatusPill, TypeIcon } from '@/components/ui/glyphs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/controls';
import { cn } from '@/lib/utils';

const PAGE = 20;

/**
 * Dense issue rows. `showProject` adds the project for lists spanning several
 * projects; `sprints` shows points and sprint instead of the status pill.
 */
export default function IssueList({
  issues,
  sprints,
  showProject = false,
  selection,
  highlight,
  empty,
  trailing,
}: {
  issues: Issue[];
  sprints?: Sprint[];
  showProject?: boolean;
  selection?: { ids: Set<number>; toggle: (id: number) => void };
  highlight?: (text: string) => ReactNode;
  empty?: ReactNode;
  trailing?: (i: Issue) => ReactNode;
}) {
  const projects = useProjects();
  const router = useRouter();
  const [page, setPage] = useState(0);
  if (!issues.length) return <>{empty ?? <Empty title="No issues here">Nothing matches yet.</Empty>}</>;
  const pages = Math.ceil(issues.length / PAGE);
  const shown = issues.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <div>
      {shown.map((i) => {
        const project = showProject ? projects.data?.find((p) => p.id === i.project_id) : undefined;
        const selected = selection?.ids.has(i.id);
        return (
          <div
            key={i.id}
            onClick={() => router.push(`/issues/${i.id}`)}
            className={cn(
              'flex h-10 cursor-pointer items-center gap-2.5 border-b border-line px-3 text-[13px] hover:bg-subtle sm:px-[18px]',
              selected && 'bg-sel hover:bg-sel',
            )}
          >
            {selection && <Checkbox checked={!!selected} onChange={() => selection.toggle(i.id)} aria-label={`Select ${i.issue_key}`} />}
            <PriorityIcon priority={i.priority} />
            <IssueKey className="hidden w-[70px] sm:inline">{i.issue_key}</IssueKey>
            <TypeIcon type={i.issue_type} size={15} />
            {!sprints && <StatusIcon status={i.status} />}
            <Link href={`/issues/${i.id}`} onClick={(e) => e.stopPropagation()} className="min-w-0 flex-1 truncate font-medium hover:text-accent-ink">
              {highlight ? highlight(i.summary) : i.summary}
            </Link>
            <span className="hidden items-center gap-1.5 md:flex">
              {i.labels.slice(0, 2).map((l) => (
                <Tag key={l} color={projectColor(l.length * 7)}>
                  {l}
                </Tag>
              ))}
            </span>
            {project && (
              <Tag color={projectColor(project.id)} className="hidden sm:inline-flex">
                {project.name}
              </Tag>
            )}
            {sprints ? (
              <>
                <span className="hidden w-24 truncate text-xs text-ink-3 sm:inline">{sprints.find((s) => s.id === i.sprint_id)?.name ?? 'Backlog'}</span>
                <Points value={i.story_points} />
              </>
            ) : (
              <span className="hidden lg:inline">
                <StatusPill status={i.status} />
              </span>
            )}
            {trailing?.(i)}
            <Avatar user={i.assignee} size={20} />
          </div>
        );
      })}
      {pages > 1 && (
        <div className="flex items-center justify-between px-[18px] py-3 text-xs text-ink-3">
          <span>
            {page * PAGE + 1}–{Math.min(issues.length, page * PAGE + PAGE)} of {issues.length}
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
    </div>
  );
}
