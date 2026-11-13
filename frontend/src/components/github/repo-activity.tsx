'use client';

import { useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
} from 'lucide-react';
import { useData } from '@/hooks/data';
import type {
  ChangeNote,
  GitHubBranches,
  GitHubCommit,
  GitHubPull,
  Project,
} from '@/types';
import { Badge, Card, Note, State } from '@/components/ui/display';
import { Segmented, Tabs } from '@/components/ui/controls';
import { Select } from '@/components/ui/select';
import { GithubIcon } from '@/components/ui/glyphs';
import { cn } from '@/lib/utils';

type Tab = 'notes' | 'pulls' | 'branches' | 'commits';
const date = (value: string) =>
  value ? new Date(value).toLocaleDateString() : '';
const Code = ({ children }: { children: string }) => (
  <code className="rounded bg-hover px-1 py-px font-mono text-[11px]">
    {children}
  </code>
);
const Hint = ({ children }: { children: ReactNode }) => (
  <p className="px-3 pt-2 text-[11.5px] text-ink-3">{children}</p>
);
const None = ({ children }: { children: ReactNode }) => (
  <p className="px-3 py-6 text-center text-[12.5px] text-ink-3">{children}</p>
);

/** A list row that acts as a toggle button when the list is selectable. */
function Row({
  onSelect,
  selected,
  children,
}: {
  onSelect?: () => void;
  selected: boolean;
  children: ReactNode;
}) {
  const props = onSelect
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-pressed': selected,
        onClick: onSelect,
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        },
      }
    : {};
  return (
    <li
      {...props}
      className={cn(
        'flex flex-col gap-1 border-b border-line px-3 py-2.5 last:border-b-0',
        onSelect && 'cursor-pointer hover:bg-hover',
        selected &&
          'bg-accent-soft shadow-[inset_3px_0_0_var(--accent)] hover:bg-accent-soft',
      )}
    >
      {children}
    </li>
  );
}

function OpenLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title="Open on GitHub (needs access to the repository)"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className="shrink-0 text-ink-3 hover:text-ink"
    >
      <ExternalLink className="size-3.5" />
    </a>
  );
}

function Pulls({
  projectId,
  repoName,
  selected,
  onSelect,
}: {
  projectId: number;
  repoName: string;
  selected?: number;
  onSelect?: (pull: GitHubPull) => void;
}) {
  const [state, setState] = useState<'open' | 'closed' | 'all'>('open');
  const pulls = useData<GitHubPull[]>(
    `/github/projects/${projectId}/pulls?state=${state}&repo=${encodeURIComponent(repoName)}`,
  );
  return (
    <>
      <div className="px-3 pt-2.5">
        <Segmented
          value={state}
          onChange={setState}
          items={[
            { key: 'open', label: 'Open' },
            { key: 'closed', label: 'Closed' },
            { key: 'all', label: 'All' },
          ]}
        />
      </div>
      <State loading={pulls.isLoading} error={pulls.error} />
      {pulls.data?.length === 0 && (
        <None>No {state === 'all' ? '' : state} pull requests.</None>
      )}
      {onSelect && !!pulls.data?.length && (
        <Hint>Select a pull request to generate from the code it changes.</Hint>
      )}
      <ul>
        {pulls.data?.map((p) => (
          <Row
            key={p.number}
            selected={selected === p.number}
            onSelect={onSelect && (() => onSelect(p))}
          >
            <div className="flex items-start gap-2 text-[13px]">
              {selected === p.number && (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent" />
              )}
              <span className="min-w-0 flex-1">
                <b className="font-semibold text-ink-3">#{p.number}</b>{' '}
                <span className="font-medium">{p.title}</span>
              </span>
              <OpenLink
                href={p.html_url}
                label={`Open pull request #${p.number} on GitHub`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-3">
              <Badge
                value={(p.draft && p.state === 'open'
                  ? 'draft'
                  : p.state
                ).toUpperCase()}
              />
              <Code>{p.head}</Code>→<Code>{p.base}</Code>
              <span>
                {p.author} · {date(p.updated_at)}
              </span>
            </div>
          </Row>
        ))}
      </ul>
    </>
  );
}

function Branches({
  repo,
  selected,
  onSelect,
}: {
  repo?: GitHubBranches;
  selected?: string;
  onSelect?: (name: string) => void;
}) {
  if (!repo) return null;
  if (!repo.branches.length)
    return <None>This repository has no branches yet.</None>;
  return (
    <ul>
      {onSelect && (
        <Hint>Select a branch to generate from the code it changes.</Hint>
      )}
      {repo.branches.map((b) => (
        <Row
          key={b.name}
          selected={selected === b.name}
          onSelect={onSelect && (() => onSelect(b.name))}
        >
          {onSelect ? (
            // Selecting stays in the app; only the small icon opens GitHub,
            // which needs access to the repository.
            <div className="flex items-center gap-2 text-[13px] font-medium">
              {selected === b.name ? (
                <CheckCircle2 className="size-3.5 shrink-0 text-accent" />
              ) : (
                <GitBranch className="size-3.5 shrink-0 text-ink-3" />
              )}
              <span className="min-w-0 flex-1 truncate">{b.name}</span>
              <OpenLink
                href={`${repo.html_url}/tree/${b.name}`}
                label={`Open branch ${b.name} on GitHub`}
              />
            </div>
          ) : (
            <a
              href={`${repo.html_url}/tree/${b.name}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-[13px] font-medium hover:text-accent-ink"
            >
              <GitBranch className="size-3.5 text-ink-3" />
              {b.name}
            </a>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {b.name === repo.default_branch && (
              <Badge tone="green">Default</Badge>
            )}
            {b.protected && <Badge>Protected</Badge>}
            <Code>{b.sha.slice(0, 7)}</Code>
          </div>
        </Row>
      ))}
    </ul>
  );
}

function Commits({
  projectId,
  repoName,
  repo,
  selected,
  onSelect,
}: {
  projectId: number;
  repoName: string;
  repo?: GitHubBranches;
  selected?: string;
  onSelect?: (commit: GitHubCommit) => void;
}) {
  const [branch, setBranch] = useState('');
  const current = branch || repo?.default_branch || '';
  const commits = useData<GitHubCommit[]>(
    `/github/projects/${projectId}/commits?repo=${encodeURIComponent(repoName)}${current ? `&branch=${encodeURIComponent(current)}` : ''}`,
    !!repo,
  );
  return (
    <>
      <div className="px-3 pt-2.5">
        <Select
          size="sm"
          className="w-full"
          aria-label="Branch"
          value={current}
          onChange={setBranch}
          options={(repo?.branches ?? []).map((b) => ({
            value: b.name,
            label: b.name,
            icon: <GitBranch className="size-3 text-ink-3" />,
          }))}
        />
      </div>
      <State loading={commits.isLoading} error={commits.error} />
      {commits.data?.length === 0 && <None>No commits on this branch.</None>}
      {onSelect && !!commits.data?.length && (
        <Hint>Select a commit to generate from the code it changes.</Hint>
      )}
      <ul>
        {commits.data?.map((c) => (
          <Row
            key={c.sha}
            selected={selected === c.sha}
            onSelect={onSelect && (() => onSelect(c))}
          >
            <div className="flex items-start gap-2 text-[13px]">
              {selected === c.sha && (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent" />
              )}
              {onSelect ? (
                <>
                  <span className="line-clamp-2 min-w-0 flex-1 font-medium">
                    {c.message}
                  </span>
                  <OpenLink
                    href={c.html_url}
                    label={`Open commit ${c.sha.slice(0, 7)} on GitHub`}
                  />
                </>
              ) : (
                <a
                  href={c.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="line-clamp-2 font-medium hover:text-accent-ink"
                >
                  {c.message}
                </a>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-3">
              <Code>{c.sha.slice(0, 7)}</Code>
              <span>
                {c.author} · {date(c.date)}
              </span>
            </div>
          </Row>
        ))}
      </ul>
    </>
  );
}

/** The repository's Changes/ notes, read on the server, so no GitHub access is needed. */
function Notes({
  projectId,
  repoName,
  selected,
  onSelect,
}: {
  projectId: number;
  repoName: string;
  selected?: string;
  onSelect: (path: string) => void;
}) {
  const notes = useData<ChangeNote[]>(
    `/ai-generator/projects/${projectId}/change-notes?repo=${encodeURIComponent(repoName)}`,
  );
  return (
    <>
      <State loading={notes.isLoading} error={notes.error} />
      {notes.data?.length === 0 && (
        <None>No change notes yet. They live in the repository&apos;s Changes/ folder.</None>
      )}
      {!!notes.data?.length && (
        <Hint>Select a change note to read it and draft from it.</Hint>
      )}
      <ul>
        {notes.data?.map((n) => (
          <Row
            key={n.path}
            selected={selected === n.path}
            onSelect={() => onSelect(n.path)}
          >
            <div className="flex items-start gap-2 text-[13px]">
              {selected === n.path ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent" />
              ) : (
                <FileText className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
              )}
              <span className="min-w-0 flex-1 font-medium">{n.title}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-3">
              {n.date && <span>{n.date}</span>}
              <Code>{n.path.split('/').pop() ?? n.path}</Code>
            </div>
          </Row>
        ))}
      </ul>
    </>
  );
}

/** Change notes, pull requests, branches and commits of the project's linked repository. */
export default function RepoActivity({
  project,
  repository,
  configured,
  selectedPull,
  onSelectPull,
  selectedCommit,
  onSelectCommit,
  selectedBranch,
  onSelectBranch,
  selectedNote,
  onSelectNote,
}: {
  project?: Project;
  /** Which linked repository to show ("owner/name"); the project's first when left out. */
  repository?: string;
  configured?: boolean;
  selectedPull?: number;
  onSelectPull?: (pull: GitHubPull) => void;
  selectedCommit?: string;
  onSelectCommit?: (commit: GitHubCommit) => void;
  selectedBranch?: string;
  onSelectBranch?: (name: string) => void;
  selectedNote?: string;
  /** When set, a Change notes tab is shown first. */
  onSelectNote?: (path: string) => void;
}) {
  const [tab, setTab] = useState<Tab>(onSelectNote ? 'notes' : 'pulls');
  const name = repository || project?.repositories[0]?.full_name;
  const ready = !!project && !!name && configured !== false;
  const repo = useData<GitHubBranches>(
    `/github/projects/${project?.id}/branches?repo=${encodeURIComponent(name ?? '')}`,
    ready,
  );
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-3 text-[13px] font-semibold">
        <GithubIcon className="size-4" />
        <span className="truncate">{name ?? 'Repository'}</span>
      </div>
      {!name ? (
        <None>
          No repository linked. Link one on the{' '}
          <Link
            href="/github"
            className="font-medium text-accent-ink hover:underline"
          >
            GitHub
          </Link>{' '}
          page.
        </None>
      ) : configured === false ? (
        <div className="p-3">
          <Note tone="amber">
            GitHub is not connected. Set GITHUB_TOKEN in backend/.env.
          </Note>
        </div>
      ) : (
        <>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              ...(onSelectNote
                ? [
                    {
                      key: 'notes' as const,
                      label: (
                        <span className="inline-flex items-center gap-1.5">
                          <FileText className="size-3.5" />
                          Notes
                        </span>
                      ),
                    },
                  ]
                : []),
              {
                key: 'pulls',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <GitPullRequest className="size-3.5" />
                    PRs
                  </span>
                ),
              },
              {
                key: 'branches',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <GitBranch className="size-3.5" />
                    Branches
                  </span>
                ),
              },
              {
                key: 'commits',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <GitCommitHorizontal className="size-3.5" />
                    Commits
                  </span>
                ),
              },
            ]}
          />
          <div className="scrollbar-thin max-h-[560px] overflow-y-auto">
            {(tab === 'branches' || tab === 'commits') && (
              <State loading={repo.isLoading} error={repo.error} />
            )}
            {tab === 'notes' && onSelectNote && (
              <Notes
                projectId={project!.id}
                repoName={name}
                selected={selectedNote}
                onSelect={onSelectNote}
              />
            )}
            {tab === 'pulls' && (
              <Pulls
                projectId={project!.id}
                repoName={name}
                selected={selectedPull}
                onSelect={onSelectPull}
              />
            )}
            {tab === 'branches' && (
              <Branches
                repo={repo.data}
                selected={selectedBranch}
                onSelect={onSelectBranch}
              />
            )}
            {tab === 'commits' && (
              <Commits
                projectId={project!.id}
                repoName={name}
                repo={repo.data}
                selected={selectedCommit}
                onSelect={onSelectCommit}
              />
            )}
          </div>
        </>
      )}
    </Card>
  );
}
