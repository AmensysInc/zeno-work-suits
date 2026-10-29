'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Calendar, Plus, Search, Users } from 'lucide-react';
import { useMe, useProjects, useSave } from '@/hooks/data';
import { canCreateProjects, canManageProject, label } from '@/types';
import { PageBar, PageBody, Toolbar } from '@/components/layout/page';
import { AvatarStack, Badge, Card, Empty, ProjectMark, State } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/controls';
import { Dialog } from '@/components/ui/dialog';
import ProjectFields from '@/components/projects/project-fields';
import AssignTeamDialog from '@/components/projects/assign-team-dialog';
import { cn, shortDate } from '@/lib/utils';

export default function ProjectsPage() {
  const query = useProjects();
  const me = useMe();
  const [open, setOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [search, setSearch] = useState('');
  const [board, setBoard] = useState<'SCRUM' | 'KANBAN'>('SCRUM');
  const form = useRef<HTMLFormElement>(null);
  const save = useSave('/projects', 'post', 'Project created');
  const canCreate = canCreateProjects(me.data?.role);
  const manageable = (query.data ?? []).filter((p) => canManageProject(me.data, p));
  const q = search.trim().toLowerCase();
  const projects = (query.data ?? []).filter(
    (p) =>
      !q ||
      [p.name, p.key, p.description, p.status, p.github_repo, p.team.map((m) => `${m.user.first_name} ${m.user.last_name} ${m.user.email}`).join(' ')]
        .filter(Boolean)
        .some((v) => v?.toLowerCase().includes(q)),
  );
  const active = (query.data ?? []).filter((p) => p.status === 'ACTIVE').length;
  const create = async () => {
    if (!form.current?.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form.current));
    try {
      await save.mutateAsync({ ...data, board_type: board });
      setOpen(false);
    } catch {
      /* toast */
    }
  };

  return (
    <>
      <PageBar
        crumbs={['Projects']}
        actions={
          <>
            {manageable.length > 0 && (
              <Button icon={<Users />} onClick={() => setAssigning(true)}>
                <span className="hidden sm:inline">Assign team member</span>
              </Button>
            )}
            {canCreate && (
              <Button variant="primary" icon={<Plus />} onClick={() => setOpen(true)}>
                New project
              </Button>
            )}
          </>
        }
      />
      {(query.data?.length ?? 0) > 0 && (
        <Toolbar>
          <Input
            size="sm"
            icon={<Search />}
            className="w-full sm:w-[320px]"
            aria-label="Search projects"
            placeholder="Search name, key, status or member…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="text-[12.5px] font-semibold">{projects.length} projects</span>
          <span className="text-xs text-ink-3">
            · {active} active · {(query.data?.length ?? 0) - active} archived
          </span>
        </Toolbar>
      )}
      <PageBody>
        <State loading={query.isLoading} error={query.error} empty={query.data?.length === 0} />
        {q && !projects.length && <Empty title="No projects match">Nothing matches “{search}”.</Empty>}
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const mine = p.team.find((m) => m.user.id === me.data?.id);
            return (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <Card className="flex h-full flex-col gap-3.5 p-4 transition-shadow hover:shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <ProjectMark project={p} size={32} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[14px] font-semibold">{p.name}</span>
                      <span className="text-[11.5px] text-ink-3">
                        <span className="font-mono">{p.key}</span> · {p.board_type === 'KANBAN' ? 'Kanban' : 'Scrum'}
                      </span>
                    </div>
                    <Badge value={p.status} />
                  </div>
                  <p className="line-clamp-2 min-h-[38px] text-[12.5px] leading-normal text-ink-2">{p.description || 'No description yet.'}</p>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <AvatarStack users={p.members} />
                    <div className="flex items-center gap-3 text-[11.5px] text-ink-3">
                      {mine && <span>{label(mine.role)}</span>}
                      {(p.start_date || p.end_date) && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="size-3" />
                          {shortDate(p.start_date) || '…'} → {shortDate(p.end_date) || '…'}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
          {canCreate && !q && (
            <button
              onClick={() => setOpen(true)}
              className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-2 text-center hover:bg-surface"
            >
              <span className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface">
                <Plus className="size-4" />
              </span>
              <span className="font-semibold">New project</span>
              <span className="text-xs text-ink-3">Admins and managers can create projects</span>
            </button>
          )}
        </div>
      </PageBody>
      {assigning && <AssignTeamDialog projects={manageable} onClose={() => setAssigning(false)} />}
      {open && (
        <Dialog
          title="New project"
          description="A shared home for your team’s next big thing."
          width={600}
          onClose={() => setOpen(false)}
          footer={
            <>
              <span className="mr-auto text-xs text-ink-3">You’ll be the project’s owner and lead.</span>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" loading={save.isPending} onClick={create}>
                Create project
              </Button>
            </>
          }
        >
          <form
            ref={form}
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
              <Field label="Project name">{(id) => <Input id={id} size="lg" name="name" required maxLength={200} autoFocus />}</Field>
              <Field label="Key">
                {(id) => <Input id={id} size="lg" name="key" required pattern="[A-Z][A-Z0-9]{1,9}" maxLength={10} placeholder="HRMS" className="font-mono" />}
              </Field>
            </div>
            <p className="-mt-2 text-xs text-ink-3">The key prefixes every issue, e.g. HRMS-12. 2–10 capital letters or digits.</p>
            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium">Board</span>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {(
                  [
                    ['SCRUM', 'Scrum', 'Plan work in time-boxed sprints with a backlog.'],
                    ['KANBAN', 'Kanban', 'Continuous flow on a board, no sprints.'],
                  ] as const
                ).map(([v, t, d]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={board === v}
                    onClick={() => setBoard(v)}
                    className={cn('flex gap-2.5 rounded-lg border border-line p-3 text-left', board === v && 'border-accent shadow-[0_0_0_3px_var(--ring)]')}
                  >
                    <span className={cn('mt-0.5 size-[15px] shrink-0 rounded-full border-[1.5px] border-line-2', board === v && 'border-[4.5px] border-accent')} />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-semibold">{t}</span>
                      <span className="text-xs text-ink-3">{d}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <Field label="Description" optional>
              {(id) => <Textarea id={id} name="description" rows={3} />}
            </Field>
            <ProjectFields />
            <button type="submit" hidden />
          </form>
        </Dialog>
      )}
    </>
  );
}
