import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Card,
  Empty,
  Input,
  Menu,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  BranchesOutlined,
  DisconnectOutlined,
  GithubOutlined,
  LinkOutlined,
  PullRequestOutlined,
} from '@ant-design/icons';
import { useData, useMe, useProjects, useSave } from '../hooks/data';
import { useCurrentProject } from '../components/layout/AppShell';
import { Badge, PageHeader, State } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/form';
import { confirm } from '../components/ui/confirm';
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
    <Card className="card">
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
        <Input
          name="name"
          required
          maxLength={200}
          pattern="[\w./\-]+"
          title="Letters, numbers, dots, dashes, underscores and slashes"
          aria-label="New branch name"
          placeholder="New branch, e.g. feature/leave-form"
        />
        <Select
          name="from_branch"
          className="inline-select"
          aria-label="Create from"
          defaultValue={repo.default_branch}
          options={repo.branches.map((b) => ({
            value: b.name,
            label: `from ${b.name}`,
          }))}
        />
        <Button
          type="submit"
          icon={<BranchesOutlined />}
          loading={create.isPending}
        >
          Create branch
        </Button>
      </form>
      <Table
        rowKey="name"
        size="middle"
        pagination={false}
        scroll={{ x: 'max-content' }}
        dataSource={repo.branches}
        locale={{ emptyText: 'This repository has no branches yet.' }}
        columns={[
          {
            title: 'Branch',
            dataIndex: 'name',
            render: (name, b) => (
              <>
                <a
                  href={`${repo.html_url}/tree/${name}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <strong>{name}</strong>
                </a>{' '}
                {name === repo.default_branch && (
                  <Tag color="green">Default</Tag>
                )}
                {b.protected && <Tag>Protected</Tag>}
              </>
            ),
          },
          {
            title: 'Latest commit',
            dataIndex: 'sha',
            render: (sha) => (
              <Typography.Text code>{sha.slice(0, 7)}</Typography.Text>
            ),
          },
          {
            key: 'actions',
            align: 'right',
            render: (_, b) =>
              b.name !== repo.default_branch && (
                <Button
                  variant="ghost"
                  icon={<PullRequestOutlined />}
                  onClick={() => onOpenPull(b.name)}
                >
                  Open pull request
                </Button>
              ),
          },
        ]}
      />
    </Card>
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
  if (pull.draft)
    return <Typography.Text type="secondary">Draft</Typography.Text>;
  return (
    <span className="actions">
      <Select
        size="small"
        aria-label={`Merge method for #${pull.number}`}
        value={method}
        onChange={setMethod}
        popupMatchSelectWidth={false}
        options={mergeMethods.map(([value, title]) => ({
          value,
          label: title,
        }))}
      />
      <Button
        size="small"
        disabled={merge.isPending}
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
    <Card className="card">
      <div className="section-head">
        <Select
          aria-label="Pull request state"
          className="inline-select"
          value={state}
          onChange={setState}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'closed', label: 'Closed and merged' },
            { value: 'all', label: 'All' },
          ]}
        />
        <Button
          icon={<PullRequestOutlined />}
          onClick={onNew}
          disabled={repo.branches.length < 2}
        >
          New pull request
        </Button>
      </div>
      <State loading={pulls.isLoading} error={pulls.error} />
      {pulls.data && !pulls.data.length && (
        <Empty
          description={`No ${state === 'all' ? '' : state} pull requests.`}
        />
      )}
      {!!pulls.data?.length && (
        <Table
          rowKey="number"
          size="middle"
          pagination={false}
          scroll={{ x: 'max-content' }}
          dataSource={pulls.data}
          columns={[
            {
              title: 'Pull request',
              key: 'title',
              className: 'wrap',
              render: (_, p) => (
                <a href={p.html_url} target="_blank" rel="noreferrer">
                  <strong>#{p.number}</strong> {p.title}
                </a>
              ),
            },
            {
              title: 'Branches',
              key: 'branches',
              render: (_, p) => (
                <>
                  <Typography.Text code>{p.head}</Typography.Text> →{' '}
                  <Typography.Text code>{p.base}</Typography.Text>
                </>
              ),
            },
            { title: 'Author', dataIndex: 'author' },
            {
              title: 'Status',
              key: 'status',
              render: (_, p) => (
                <Badge
                  value={p.draft && p.state === 'open' ? 'draft' : p.state}
                />
              ),
            },
            {
              title: 'Updated',
              dataIndex: 'updated_at',
              render: (v) => new Date(v).toLocaleDateString(),
            },
            {
              key: 'merge',
              align: 'right',
              render: (_, p) =>
                p.state === 'open' &&
                repo.can_merge && (
                  <MergeControl projectId={project.id} pull={p} />
                ),
            },
          ]}
        />
      )}
      {!repo.can_merge && (
        <p className="muted">
          Merging is limited to admins, the managing owner and project leads.
        </p>
      )}
    </Card>
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
          <Typography.Title level={4}>
            <GithubOutlined /> {repoName(project.github_repo)}
          </Typography.Title>
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
            icon={<DisconnectOutlined />}
            disabled={unlink.isPending}
            onClick={async () => {
              if (
                await confirm(
                  `Unlink ${repoName(project.github_repo)} from ${project.name}? Nothing is changed on GitHub.`,
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
        activeKey={tab}
        onChange={(v) => setTab(v as 'branches' | 'pulls')}
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
  const [params, setParams] = useSearchParams();
  const switcherProject = useCurrentProject();
  const linked = (projects.data ?? []).filter((p) => repoName(p.github_repo));
  const manageable = (projects.data ?? []).filter((p) =>
    canManageProject(me.data, p),
  );
  // The repository follows the project in the URL and the top-bar switcher.
  const wanted = Number(params.get('project')) || switcherProject;
  const wantedProject = projects.data?.find((p) => p.id === wanted);
  const current = wantedProject
    ? linked.find((p) => p.id === wantedProject.id)
    : linked[0];
  const select = (id: number) => {
    const next = new URLSearchParams(params);
    next.set('project', String(id));
    setParams(next);
  };
  // Put a fallback repository's project in the URL so the switcher shows it too.
  const shownId = current?.id;
  useEffect(() => {
    if (shownId && !params.get('project')) {
      const next = new URLSearchParams(params);
      next.set('project', String(shownId));
      setParams(next, { replace: true });
    }
  }, [params, setParams, shownId]);
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
            <Button icon={<LinkOutlined />} onClick={() => setLinking(true)}>
              Link repository
            </Button>
          )}
      </PageHeader>
      {status.data && !configured && (
        <Alert
          className="github-setup"
          type="warning"
          showIcon
          title="Connect GitHub"
          description={
            <>
              Add a GitHub personal access token as <code>GITHUB_TOKEN</code> in{' '}
              <code>backend/.env</code>, then restart the backend. Give it
              access to the repositories you want to link, with read and write
              permission for <strong>Contents</strong> and{' '}
              <strong>Pull requests</strong>.
            </>
          }
        />
      )}
      <State
        loading={projects.isLoading || status.isLoading}
        error={projects.error || status.error}
      />
      {projects.data && !linked.length && (
        <Empty
          description={`No linked repositories yet.${
            configured && manageable.length > 0
              ? ' Use “Link repository” to connect one to a project.'
              : ' Ask an admin or a project’s manager to link one.'
          }`}
        />
      )}
      {wantedProject && !current && linked.length > 0 && (
        <Alert
          className="github-setup"
          type="info"
          showIcon
          title={`${wantedProject.name} has no linked repository.`}
          description={
            canManageProject(me.data, wantedProject) && configured
              ? 'Use “Link repository” to connect one, or pick a linked repository below.'
              : 'Pick a linked repository below, or ask an admin or the project’s manager to link one.'
          }
        />
      )}
      {linked.length > 0 && (
        <div className="github-layout">
          <Card
            className="card github-repos"
            title="Linked repositories"
            size="small"
          >
            <Menu
              aria-label="Linked repositories"
              mode="inline"
              selectedKeys={current ? [String(current.id)] : []}
              onClick={({ key }) => select(Number(key))}
              items={linked.map((p) => ({
                key: String(p.id),
                icon: (
                  <Avatar shape="square" size={28} className="project-icon">
                    {p.key.slice(0, 2)}
                  </Avatar>
                ),
                label: (
                  <span className="repo-item">
                    <strong>{p.name}</strong>
                    <span className="muted">{repoName(p.github_repo)}</span>
                  </span>
                ),
              }))}
            />
          </Card>
          <div>
            {!current ? (
              <Empty description="Select a linked repository." />
            ) : configured ? (
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
          onLinked={(id) => select(id)}
          onClose={() => setLinking(false)}
        />
      )}
    </>
  );
}
