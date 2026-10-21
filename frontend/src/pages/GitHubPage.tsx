import { useState } from 'react';
import { useData, useMe, useProjects, useSave } from '../hooks/data';
import { Badge, PageHeader, State } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import LinkRepoModal from '../components/github/LinkRepoModal';
import NewPullModal from '../components/github/NewPullModal';
import {
  canCreateProjects,
  canManageProject,
  repoName,
  type GitHubBranches,
  type GitHubPull,
  type Project,
} from '../types';

const mergeMethods = [
  ['merge', 'Merge commit'],
  ['squash', 'Squash and merge'],
  ['rebase', 'Rebase and merge'],
] as const;

function Branches({
  project,
  repo,
  onOpenPull,
}: {
  project: Project;
  repo: GitHubBranches;
  onOpenPull: (head: string) => void;
}) {
  const create = useSave(
    `/github/projects/${project.id}/branches`,
    'post',
    'Branch created',
  );
  return (
    <section className="card">
      <form
        className="inline-form github-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          try {
            await create.mutateAsync({
              name: data.get('name'),
              from_branch: data.get('from_branch'),
            });
            form.reset();
          } catch {
            /* toast */
          }
        }}
      >
        <input
          name="name"
          required
          maxLength={200}
          pattern="[\w./\-]+"
          title="Letters, numbers, dots, dashes, underscores and slashes"
          aria-label="New branch name"
          placeholder="New branch, e.g. feature/leave-form"
        />
        <select
          name="from_branch"
          aria-label="Create from"
          defaultValue={repo.default_branch}
        >
          {repo.branches.map((b) => (
            <option key={b.name} value={b.name}>
              from {b.name}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={create.isPending}>
          Create branch
        </Button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Branch</th>
              <th>Latest commit</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {repo.branches.map((b) => (
              <tr key={b.name}>
                <td>
                  <a
                    href={`${repo.html_url}/tree/${b.name}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <strong>{b.name}</strong>
                  </a>{' '}
                  {b.name === repo.default_branch && (
                    <span className="badge badge-active">Default</span>
                  )}{' '}
                  {b.protected && <span className="badge">Protected</span>}
                </td>
                <td>
                  <code>{b.sha.slice(0, 7)}</code>
                </td>
                <td className="row-actions">
                  {b.name !== repo.default_branch && (
                    <Button variant="ghost" onClick={() => onOpenPull(b.name)}>
                      Open pull request
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!repo.branches.length && (
        <p className="muted">This repository has no branches yet.</p>
      )}
    </section>
  );
}

function MergeControl({
  projectId,
  pull,
}: {
  projectId: number;
  pull: GitHubPull;
}) {
  const [method, setMethod] = useState<string>('merge');
  const merge = useSave(
    `/github/projects/${projectId}/pulls/${pull.number}/merge`,
    'put',
    `Pull request #${pull.number} merged`,
  );
  if (pull.draft) return <span className="muted">Draft</span>;
  return (
    <span className="actions">
      <select
        aria-label={`Merge method for #${pull.number}`}
        value={method}
        onChange={(e) => setMethod(e.target.value)}
      >
        {mergeMethods.map(([value, title]) => (
          <option key={value} value={value}>
            {title}
          </option>
        ))}
      </select>
      <Button
        disabled={merge.isPending}
        onClick={() => {
          if (
            window.confirm(
              `Merge #${pull.number} "${pull.title}" into ${pull.base}?`,
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
  repo,
  onNew,
}: {
  project: Project;
  repo: GitHubBranches;
  onNew: () => void;
}) {
  const [state, setState] = useState('open');
  const pulls = useData<GitHubPull[]>(
    `/github/projects/${project.id}/pulls?state=${state}`,
  );
  return (
    <section className="card">
      <div className="section-head">
        <select
          aria-label="Pull request state"
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          <option value="open">Open</option>
          <option value="closed">Closed and merged</option>
          <option value="all">All</option>
        </select>
        <Button onClick={onNew} disabled={repo.branches.length < 2}>
          New pull request
        </Button>
      </div>
      <State loading={pulls.isLoading} error={pulls.error} />
      {pulls.data && !pulls.data.length && (
        <p className="muted">
          No {state === 'all' ? '' : state} pull requests.
        </p>
      )}
      {!!pulls.data?.length && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pull request</th>
                <th>Branches</th>
                <th>Author</th>
                <th>Status</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pulls.data.map((p) => (
                <tr key={p.number}>
                  <td className="wrap">
                    <a href={p.html_url} target="_blank" rel="noreferrer">
                      <strong>#{p.number}</strong> {p.title}
                    </a>
                  </td>
                  <td>
                    <code>{p.head}</code> → <code>{p.base}</code>
                  </td>
                  <td>{p.author}</td>
                  <td>
                    <Badge
                      value={p.draft && p.state === 'open' ? 'draft' : p.state}
                    />
                  </td>
                  <td>{new Date(p.updated_at).toLocaleDateString()}</td>
                  <td className="row-actions">
                    {p.state === 'open' && repo.can_merge && (
                      <MergeControl projectId={project.id} pull={p} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!repo.can_merge && (
        <p className="muted">
          Merging is limited to admins, the managing owner and project leads.
        </p>
      )}
    </section>
  );
}

function Repository({
  project,
  canManage,
}: {
  project: Project;
  canManage: boolean;
}) {
  const [tab, setTab] = useState<'branches' | 'pulls'>('branches');
  const [pullHead, setPullHead] = useState<string | null>(null);
  const repo = useData<GitHubBranches>(
    `/github/projects/${project.id}/branches`,
  );
  const unlink = useSave(
    `/github/projects/${project.id}/repository`,
    'delete',
    'Repository unlinked',
  );
  return (
    <>
      <div className="section-head">
        <div>
          <h2>{repoName(project.github_repo)}</h2>
          <a
            className="muted"
            href={project.github_repo}
            target="_blank"
            rel="noreferrer"
          >
            Open on GitHub ↗
          </a>
        </div>
        {canManage && (
          <Button
            variant="ghost"
            disabled={unlink.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `Unlink ${repoName(project.github_repo)} from ${project.name}? Nothing is changed on GitHub.`,
                )
              )
                unlink.mutate({});
            }}
          >
            Unlink
          </Button>
        )}
      </div>
      <div className="tabs">
        <button
          className={tab === 'branches' ? 'selected' : ''}
          onClick={() => setTab('branches')}
        >
          Branches{repo.data ? ` · ${repo.data.branches.length}` : ''}
        </button>
        <button
          className={tab === 'pulls' ? 'selected' : ''}
          onClick={() => setTab('pulls')}
        >
          Pull requests
        </button>
      </div>
      <State loading={repo.isLoading} error={repo.error} />
      {repo.data && tab === 'branches' && (
        <Branches
          project={project}
          repo={repo.data}
          onOpenPull={(head) => setPullHead(head)}
        />
      )}
      {repo.data && tab === 'pulls' && (
        <Pulls
          project={project}
          repo={repo.data}
          onNew={() => setPullHead('')}
        />
      )}
      {repo.data && pullHead !== null && (
        <NewPullModal
          projectId={project.id}
          repo={repo.data}
          head={pullHead || undefined}
          onClose={() => {
            setPullHead(null);
            setTab('pulls');
          }}
        />
      )}
    </>
  );
}

export default function GitHubPage() {
  const me = useMe();
  const projects = useProjects();
  const status = useData<{ configured: boolean }>('/github/status');
  const [linking, setLinking] = useState(false);
  const [selected, setSelected] = useState<number>();
  const linked = (projects.data ?? []).filter((p) => repoName(p.github_repo));
  const manageable = (projects.data ?? []).filter((p) =>
    canManageProject(me.data, p),
  );
  const current = linked.find((p) => p.id === selected) ?? linked[0];
  const configured = status.data?.configured;
  return (
    <>
      <PageHeader
        title="GitHub"
        description="Manage branches, pull requests and merges for your linked repositories."
      >
        {configured &&
          canCreateProjects(me.data?.role) &&
          manageable.length > 0 && (
            <Button onClick={() => setLinking(true)}>Link repository</Button>
          )}
      </PageHeader>
      {status.data && !configured && (
        <section className="card github-setup">
          <h2>Connect GitHub</h2>
          <p>
            Add a GitHub personal access token as <code>GITHUB_TOKEN</code> in{' '}
            <code>backend/.env</code>, then restart the backend. Give it access
            to the repositories you want to link, with read and write permission
            for <strong>Contents</strong> and <strong>Pull requests</strong>.
          </p>
        </section>
      )}
      <State
        loading={projects.isLoading || status.isLoading}
        error={projects.error || status.error}
      />
      {projects.data && !linked.length && (
        <div className="empty">
          No linked repositories yet.
          {configured && manageable.length > 0
            ? ' Use “Link repository” to connect one to a project.'
            : ' Ask an admin or a project’s manager to link one.'}
        </div>
      )}
      {current && (
        <div className="github-layout">
          <nav className="card github-repos" aria-label="Linked repositories">
            <small className="nav-heading">LINKED REPOSITORIES</small>
            {linked.map((p) => (
              <button
                key={p.id}
                className={p.id === current.id ? 'nav-link active' : 'nav-link'}
                onClick={() => setSelected(p.id)}
              >
                <span className="project-icon">{p.key.slice(0, 2)}</span>
                <span>
                  <strong>{p.name}</strong>
                  <br />
                  <span className="muted">{repoName(p.github_repo)}</span>
                </span>
              </button>
            ))}
          </nav>
          <div>
            {configured ? (
              <Repository
                key={current.id}
                project={current}
                canManage={canManageProject(me.data, current)}
              />
            ) : (
              <p className="muted">
                Connect GitHub to see branches and pull requests for{' '}
                {repoName(current.github_repo)}.
              </p>
            )}
          </div>
        </div>
      )}
      {linking && (
        <LinkRepoModal
          projects={manageable}
          initialProject={
            current && manageable.some((p) => p.id === current.id)
              ? current.id
              : undefined
          }
          onLinked={setSelected}
          onClose={() => setLinking(false)}
        />
      )}
    </>
  );
}
