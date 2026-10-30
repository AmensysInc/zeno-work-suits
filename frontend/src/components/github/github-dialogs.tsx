'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Lock, Search } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useData, useSave } from '@/hooks/data';
import type { GitHubBranches, GitHubRepo, Project } from '@/types';
import { Dialog } from '@/components/ui/dialog';
import { Badge, Note } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/controls';
import { cn } from '@/lib/utils';

export function LinkRepoDialog({
  projects,
  initialProject,
  onLinked,
  onClose,
}: {
  projects: Project[];
  initialProject?: number;
  onLinked: (projectId: number, fullName: string) => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const repos = useData<GitHubRepo[]>('/github/repos');
  const [projectId, setProjectId] = useState(initialProject ?? projects[0]?.id);
  const project = projects.find((p) => p.id === projectId);
  // Repositories this project already links (lowercase); linking adds to them.
  const already = new Set(
    (project?.repositories ?? []).map((r) => r.full_name.toLowerCase()),
  );
  // Several repositories can be ticked and linked together.
  const [chosen, setChosen] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const shown = (repos.data ?? []).filter((r) =>
    `${r.full_name} ${r.description}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const toggle = (name: string) =>
    setChosen((list) =>
      list.includes(name) ? list.filter((n) => n !== name) : [...list, name],
    );
  const submit = async () => {
    if (!chosen.length || !projectId) return;
    setBusy(true);
    const linked: string[] = [];
    const failed: string[] = [];
    // One at a time, so each repository gets its own permission check and message.
    for (const name of chosen) {
      try {
        await api.put(`/github/projects/${projectId}/repository`, {
          full_name: name,
        });
        linked.push(name);
      } catch (e) {
        failed.push(`${name}: ${errorMessage(e)}`);
      }
    }
    await qc.invalidateQueries();
    setBusy(false);
    if (linked.length)
      toast.success(
        linked.length === 1
          ? `Linked ${linked[0]}`
          : `Linked ${linked.length} repositories`,
      );
    failed.forEach((message) => toast.error(message));
    if (linked.length) onLinked(projectId, linked[0]);
    if (!failed.length) onClose();
    else setChosen((list) => list.filter((n) => !linked.includes(n)));
  };
  return (
    <Dialog
      title="Link repositories"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!chosen.length}
            onClick={submit}
          >
            {chosen.length > 1
              ? `Link ${chosen.length} repositories`
              : 'Link repository'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field label="Project">
          {(id) => (
            <Select<number>
              id={id}
              value={projectId}
              onChange={(v) => {
                setProjectId(v);
                setChosen([]);
              }}
              options={projects.map((p) => ({
                value: p.id,
                label: `${p.name} · ${p.key}${p.repositories.length ? ` (${p.repositories.length} linked)` : ''}`,
              }))}
            />
          )}
        </Field>
        <Note tone="blue">
          Tick every repository this project uses.
          {already.size
            ? ` It already links ${already.size}; those stay linked.`
            : ''}
        </Note>
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between text-[12.5px] font-medium">
            Available repositories
            {chosen.length > 0 && (
              <span className="font-normal text-accent-ink">
                {chosen.length} selected
              </span>
            )}
          </span>
          <Input
            icon={<Search />}
            aria-label="Search repositories"
            placeholder="Search repositories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {repos.isLoading && (
            <p className="text-[12.5px] text-ink-3">
              Loading repositories from GitHub…
            </p>
          )}
          {!!repos.error && (
            <Note tone="red">
              Unable to load repositories. Check that GitHub is connected.
            </Note>
          )}
          {repos.data && !shown.length && (
            <p className="text-[12.5px] text-ink-3">
              {repos.data.length
                ? 'No repositories match your search.'
                : 'The connected GitHub account has no repositories.'}
            </p>
          )}
          {shown.length > 0 && (
            <div
              role="group"
              aria-label="Repositories"
              className="scrollbar-thin max-h-72 overflow-y-auto rounded-lg border border-line p-1"
            >
              {shown.map((r) => {
                const linkedHere = already.has(r.full_name.toLowerCase());
                const on = linkedHere || chosen.includes(r.full_name);
                return (
                  <button
                    key={r.full_name}
                    role="checkbox"
                    aria-checked={on}
                    disabled={linkedHere}
                    onClick={() => toggle(r.full_name)}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-md p-2.5 text-left hover:bg-hover disabled:cursor-default disabled:hover:bg-transparent',
                      on &&
                        !linkedHere &&
                        'bg-accent-soft hover:bg-accent-soft',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-[15px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px] border-line-2',
                        on && 'border-accent bg-accent text-white',
                        linkedHere && 'opacity-50',
                      )}
                    >
                      {on && <Check className="size-[11px]" strokeWidth={3} />}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold">
                        {r.full_name}
                        {r.private && <Badge icon={<Lock />}>Private</Badge>}
                        {linkedHere && (
                          <Badge tone="green">Linked to this project</Badge>
                        )}
                      </span>
                      <span className="truncate text-xs text-ink-3">
                        {r.linked_projects.length
                          ? `Linked to ${r.linked_projects.join(', ')}`
                          : r.description ||
                            `Default branch ${r.default_branch}`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export function NewPullDialog({
  projectId,
  fullName,
  repo,
  head,
  onClose,
}: {
  projectId: number;
  fullName: string;
  repo: GitHubBranches;
  head?: string;
  onClose: () => void;
}) {
  const save = useSave(
    `/github/projects/${projectId}/pulls?repo=${encodeURIComponent(fullName)}`,
    'post',
    'Pull request opened',
  );
  const form = useRef<HTMLFormElement>(null);
  const names = repo.branches.map((b) => b.name);
  const branches = names.map((n) => ({ value: n, label: n }));
  const [from, setFrom] = useState(
    head ?? names.find((n) => n !== repo.default_branch) ?? names[0],
  );
  const [base, setBase] = useState(repo.default_branch);
  const [draft, setDraft] = useState(false);
  const submit = async () => {
    if (!form.current?.reportValidity()) return;
    const f = new FormData(form.current);
    try {
      await save.mutateAsync({
        title: f.get('title'),
        head: from,
        base,
        body: f.get('body'),
        draft,
      });
      onClose();
    } catch {
      /* toast */
    }
  };
  return (
    <Dialog
      title="New pull request"
      onClose={onClose}
      footer={
        <>
          <Checkbox
            className="mr-auto"
            checked={draft}
            onChange={setDraft}
            label="Open as a draft"
          />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            Open pull request
          </Button>
        </>
      }
    >
      <form
        ref={form}
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Merge from (head)">
            {(id) => (
              <Select
                id={id}
                value={from}
                onChange={setFrom}
                options={branches}
              />
            )}
          </Field>
          <Field label="Into (base)">
            {(id) => (
              <Select
                id={id}
                value={base}
                onChange={setBase}
                options={branches}
              />
            )}
          </Field>
        </div>
        <Field label="Title">
          {(id) => (
            <Input id={id} name="title" required maxLength={256} autoFocus />
          )}
        </Field>
        <Field label="Description" optional>
          {(id) => (
            <Textarea
              id={id}
              name="body"
              rows={4}
              placeholder="What changed and why"
            />
          )}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
