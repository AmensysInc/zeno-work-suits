'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ExternalLink,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Link2,
  Unlink,
} from 'lucide-react';
import { useData, useMe, useProjects, useSave } from '@/hooks/data';
import { useCurrentProject } from '@/components/layout/context';
import { PageBar, PageBody } from '@/components/layout/page';
import {
  Badge,
  Card,
  Empty,
  Note,
  ProjectMark,
  State,
} from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/controls';
import { GithubIcon } from '@/components/ui/glyphs';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { confirm } from '@/components/ui/confirm';
import {
  LinkRepoDialog,
  NewPullDialog,
} from '@/components/github/github-dialogs';
import {
  canCreateProjects,
  canManageProject,
  type GitHubBranches,
  type GitHubPull,
  type Project,
} from '@/types';

/** Query string naming which of the project's linked repositories an action targets. */
const repoQuery = (fullName: string) => `repo=${encodeURIComponent(fullName)}`;
import { cn } from '@/lib/utils';

const mergeMethods = [
  ['merge', 'Merge commit'],
  ['squash', 'Squash and merge'],
  ['rebase', 'Rebase and merge'],
] as const;

const Code = ({ children }: { children: string }) => (
  <code className="rounded bg-hover px-1.5 py-0.5 font-mono text-[11.5px]">
    {children}
  </code>
);

function Branches({
  project,
  fullName,
  repo,
  onOpenPull,
}: {
  project: Project;
  fullName: string;
  repo: GitHubBranches;
  onOpenPull: (head: string) => void;
}) {
  const create = useSave(
    `/github/projects/${project.id}/branches?${repoQuery(fullName)}`,
    'post',
    'Branch created',
  );
  const [from, setFrom] = useState(repo.default_branch);
  return (
    <>
      <form
        className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          try {
            await create.mutateAsync({
              name: new FormData(form).get('name'),
              from_branch: from,
            });
            form.reset();
          } catch {
            /* toast */
          }
        }}
      >
        <Input
          name="name"
          required
          maxLength={200}
          pattern="[\w./\-]+"
          title="Letters, numbers, dots, dashes, underscores and slashes"
          aria-label="New branch name"
          placeholder="New branch, e.g. feature/leave-form"
          className="min-w-[200px] flex-1"
          icon={<GitBranch />}
        />
        <Select
          aria-label="Create from"
          className="w-44"
          value={from}
          onChange={setFrom}
          options={repo.branches.map((b) => ({
            value: b.name,
            label: `from ${b.name}`,
          }))}
        />
        <Button type="submit" variant="primary" loading={create.isPending}>
          Create branch
        </Button>
      </form>
      {!repo.branches.length ? (
        <p className="px-4 py-6 text-center text-[12.5px] text-ink-3">
          This repository has no branches yet.
        </p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Branch</Th>
              <Th className="w-32">Latest commit</Th>
              <Th className="w-48" />
            </tr>
          </thead>
          <tbody>
            {repo.branches.map((b) => (
              <Tr key={b.name}>
                <Td>
                  <span className="flex flex-wrap items-center gap-2">
                    <GitBranch className="size-3.5 text-ink-3" />
                    <a
                      href={`${repo.html_url}/tree/${b.name}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium hover:text-accent-ink hover:underline"
                    >
                      {b.name}
                    </a>
                    {b.name === repo.default_branch && (
                      <Badge tone="green">Default</Badge>
                    )}
                    {b.protected && <Badge>Protected</Badge>}
                  </span>
                </Td>
                <Td>
                  <Code>{b.sha.slice(0, 7)}</Code>
                </Td>
                <Td className="text-right">
                  {b.name !== repo.default_branch && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<GitPullRequest />}
                      onClick={() => onOpenPull(b.name)}
                    >
                      Open pull request
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

function MergeControl({
  projectId,
  fullName,
  pull,
}: {
  projectId: number;
  fullName: string;
  pull: GitHubPull;
}) {
  const [method, setMethod] = useState<string>('merge');
  const merge = useSave(
    `/github/projects/${projectId}/pulls/${pull.number}/merge?${repoQuery(fullName)}`,
    'put',
    `Pull request #${pull.number} merged`,
  );
  if (pull.draft) return <span className="text-xs text-ink-3">Draft</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Select
        size="sm"
        className="w-40"
        aria-label={`Merge method for #${pull.number}`}
        value={method}
        onChange={setMethod}
        options={mergeMethods.map(([value, title]) => ({
          value,
          label: title,
        }))}
      />
      <Button
        size="sm"
        variant="success"
        icon={<GitMerge />}
        loading={merge.isPending}
        onClick={async () => {
          if (
            await confirm(
              `Merge #${pull.number} "${pull.title}" into ${pull.base}?`,
              { danger: false, okText: 'Merge' },
            )
          )
            merge.mutate({ method });
        }}
      >
        Merge
      </Button>
    </span>
  );
}

function Pulls({
  project,
  fullName,
  repo,
  onNew,
}: {
  project: Project;
  fullName: string;
  repo: GitHubBranches;
  onNew: () => void;
}) {
  const [state, setState] = useState('open');
  const pulls = useData<GitHubPull[]>(
    `/github/projects/${project.id}/pulls?state=${state}&${repoQuery(fullName)}`,
  );
  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <Select
          aria-label="Pull request state"
          className="w-44"
          value={state}
          onChange={setState}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'closed', label: 'Closed and merged' },
            { value: 'all', label: 'All' },
          ]}
        />
        <Button
          variant="primary"
          icon={<GitPullRequest />}
          onClick={onNew}
          disabled={repo.branches.length < 2}
        >
          New pull request
        </Button>
      </div>
      <State loading={pulls.isLoading} error={pulls.error} />
      {pulls.data && !pulls.data.length && (
        <Empty
          icon={<GitPullRequest />}
          title={`No ${state === 'all' ? '' : state} pull requests`}
        />
      )}
      {!!pulls.data?.length && (
        <Table>
          <thead>
            <tr>
              <Th>Pull request</Th>
              <Th>Branches</Th>
              <Th className="w-32">Author</Th>
              <Th className="w-24">Status</Th>
              <Th className="w-28">Updated</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {pulls.data.map((p) => (
              <Tr key={p.number}>
                <Td>
                  <a
                    href={p.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-accent-ink hover:underline"
                  >
                    <b className="font-semibold text-ink-3">#{p.number}</b>{' '}
                    <span className="font-medium">{p.title}</span>
                  </a>
                </Td>
                <Td className="whitespace-nowrap">
                  <Code>{p.head}</Code> <span className="text-ink-3">→</span>{' '}
                  <Code>{p.base}</Code>
                </Td>
                <Td className="text-ink-2">{p.author}</Td>
                <Td>
                  <Badge
                    value={(p.draft && p.state === 'open'
                      ? 'draft'
                      : p.state
                    ).toUpperCase()}
                    dot
                  />
                </Td>
                <Td className="whitespace-nowrap text-[12.5px] text-ink-2">
                  {new Date(p.updated_at).toLocaleDateString()}
                </Td>
                <Td className="text-right">
                  {p.state === 'open' && repo.can_merge && (
                    <MergeControl
                      projectId={project.id}
                      fullName={fullName}
                      pull={p}
                    />
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      {!repo.can_merge && (
        <p className="px-4 py-3 text-xs text-ink-3">
          Merging is limited to admins, the managing owner and project leads.
        </p>
      )}
    </>
  );
}

function Repository({
  project,
  fullName,
  htmlUrl,
  canManage,
}: {
  project: Project;
  fullName: string;
  htmlUrl: string;
  canManage: boolean;
}) {
  const [tab, setTab] = useState<'branches' | 'pulls'>('branches');
  const [pullHead, setPullHead] = useState<string | null>(null);
  const repo = useData<GitHubBranches>(
    `/github/projects/${project.id}/branches?${repoQuery(fullName)}`,
  );
  const unlink = useSave(
    `/github/projects/${project.id}/repository?${repoQuery(fullName)}`,
    'delete',
    'Repository unlinked',
  );
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-ink text-surface">
          <GithubIcon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-semibold">{fullName}</span>
          <a
            href={htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink"
          >
            Open on GitHub <ExternalLink className="size-3" />
          </a>
        </div>
        {canManage && (
          <Button
            variant="ghost"
            icon={<Unlink />}
            disabled={unlink.isPending}
            onClick={async () => {
              if (
                await confirm(
                  `Unlink ${fullName} from ${project.name}? Its other repositories stay linked, and nothing is changed on GitHub.`,
                  { okText: 'Unlink' },
                )
              )
                unlink.mutate({});
            }}
          >
            Unlink
          </Button>
        )}
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          {
            key: 'branches',
            label: `Branches${repo.data ? ` · ${repo.data.branches.length}` : ''}`,
          },
          { key: 'pulls', label: 'Pull requests' },
        ]}
      />
      <State loading={repo.isLoading} error={repo.error} />
      {repo.data && tab === 'branches' && (
        <Branches
          project={project}
          fullName={fullName}
          repo={repo.data}
          onOpenPull={(head) => setPullHead(head)}
        />
      )}
      {repo.data && tab === 'pulls' && (
        <Pulls
          project={project}
          fullName={fullName}
          repo={repo.data}
          onNew={() => setPullHead('')}
        />
      )}
      {repo.data && pullHead !== null && (
        <NewPullDialog
          projectId={project.id}
          fullName={fullName}
          repo={repo.data}
          head={pullHead || undefined}
          onClose={() => {
            setPullHead(null);
            setTab('pulls');
          }}
        />
      )}
    </Card>
  );
}

export default function GitHubPage() {
  const me = useMe();
  const projects = useProjects();
  const status = useData<{ configured: boolean }>('/github/status');
  const [linking, setLinking] = useState(false);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const switcherProject = useCurrentProject();
  const linked = (projects.data ?? []).filter((p) => p.repositories.length);
  const manageable = (projects.data ?? []).filter((p) =>
    canManageProject(me.data, p),
  );
  // The repository follows the project in the URL and the sidebar switcher.
  const wanted = Number(params.get('project')) || switcherProject;
  const wantedProject = projects.data?.find((p) => p.id === wanted);
  const current = wantedProject
    ? linked.find((p) => p.id === wantedProject.id)
    : linked[0];
  // A project can link several repositories; ?repo= picks one, else its first.
  const currentRepo =
    current?.repositories.find(
      (r) =>
        r.full_name.toLowerCase() === (params.get('repo') ?? '').toLowerCase(),
    ) ?? current?.repositories[0];
  const select = (id: number, repo?: string) => {
    const next = new URLSearchParams(params);
    next.set('project', String(id));
    if (repo) next.set('repo', repo);
    else next.delete('repo');
    router.push(`${pathname}?${next}`);
  };
  // Put a fallback repository's project in the URL so the switcher shows it too.
  const shownId = current?.id;
  useEffect(() => {
    if (shownId && !params.get('project')) {
      const next = new URLSearchParams(params);
      next.set('project', String(shownId));
      router.replace(`${pathname}?${next}`);
    }
  }, [params, router, pathname, shownId]);
  const configured = status.data?.configured;
  return (
    <>
      <PageBar
        crumbs={['GitHub']}
        actions={
          configured &&
          canCreateProjects(me.data?.role) &&
          manageable.length > 0 && (
            <Button
              variant="primary"
              icon={<Link2 />}
              onClick={() => setLinking(true)}
            >
              Link repository
            </Button>
          )
        }
      />
      <PageBody>
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-ink-2">
            Manage branches, pull requests and merges for your linked
            repositories.
          </p>
          {status.data && !configured && (
            <Note tone="amber">
              <b>Connect GitHub.</b> Add a GitHub personal access token as{' '}
              <code>GITHUB_TOKEN</code> in <code>backend/.env</code>, then
              restart the backend. Give it access to the repositories you want
              to link, with read and write permission for <b>Contents</b> and{' '}
              <b>Pull requests</b>.
            </Note>
          )}
          <State
            loading={projects.isLoading || status.isLoading}
            error={projects.error || status.error}
          />
          {projects.data && !linked.length && (
            <Card>
              <Empty icon={<GithubIcon />} title="No linked repositories yet">
                {configured && manageable.length > 0
                  ? 'Use “Link repository” to connect one to a project.'
                  : 'Ask an admin or a project’s manager to link one.'}
              </Empty>
            </Card>
          )}
          {wantedProject && !current && linked.length > 0 && (
            <Note tone="blue">
              <b>{wantedProject.name} has no linked repository.</b>{' '}
              {canManageProject(me.data, wantedProject) && configured
                ? 'Use “Link repository” to connect one, or pick a linked repository below.'
                : 'Pick a linked repository below, or ask an admin or the project’s manager to link one.'}
            </Note>
          )}
          {linked.length > 0 && (
            <div className="grid items-start gap-4 lg:grid-cols-[260px_1fr]">
              <Card className="p-2">
                <span className="caps block px-2 pb-1.5 pt-1">
                  Linked repositories
                </span>
                <nav
                  aria-label="Linked repositories"
                  className="flex flex-col gap-2"
                >
                  {linked.map((p) => (
                    <div key={p.id} className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-2 px-2 pb-0.5 pt-1 text-[12.5px] font-semibold">
                        <ProjectMark project={p} size={18} />
                        <span className="truncate">{p.name}</span>
                        <span className="text-xs font-medium text-ink-3">
                          {p.repositories.length}
                        </span>
                      </span>
                      {p.repositories.map((r) => {
                        const active =
                          current?.id === p.id &&
                          currentRepo?.full_name === r.full_name;
                        return (
                          <button
                            key={r.full_name}
                            onClick={() => select(p.id, r.full_name)}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              'flex items-center gap-2 rounded-md py-1.5 pl-7 pr-2 text-left text-[13px] text-ink-2 hover:bg-hover',
                              active && 'bg-sel font-medium text-ink',
                            )}
                          >
                            <GithubIcon className="size-3.5 shrink-0 text-ink-3" />
                            <span className="truncate">{r.full_name}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </nav>
              </Card>
              <div className="min-w-0">
                {!current || !currentRepo ? (
                  <Card>
                    <Empty title="Select a linked repository" />
                  </Card>
                ) : configured ? (
                  <Repository
                    key={`${current.id}:${currentRepo.full_name}`}
                    project={current}
                    fullName={currentRepo.full_name}
                    htmlUrl={currentRepo.html_url}
                    canManage={canManageProject(me.data, current)}
                  />
                ) : (
                  <p className="text-[13px] text-ink-3">
                    Connect GitHub to see branches and pull requests for{' '}
                    {currentRepo.full_name}.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </PageBody>
      {linking && (
        <LinkRepoDialog
          projects={manageable}
          initialProject={
            current && manageable.some((p) => p.id === current.id)
              ? current.id
              : undefined
          }
          onLinked={select}
          onClose={() => setLinking(false)}
        />
      )}
    </>
  );
}
