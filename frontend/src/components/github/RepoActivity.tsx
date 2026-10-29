import { useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Card, Empty, Segmented, Tag, Typography } from 'antd';
import {
  BranchesOutlined,
  CheckCircleFilled,
  ExportOutlined,
  GithubOutlined,
  NodeIndexOutlined,
  PullRequestOutlined,
} from '@ant-design/icons';
import { useData } from '../../hooks/data';
import {
  repoName,
  type GitHubBranches,
  type GitHubCommit,
  type GitHubPull,
  type Project,
} from '../../types';
import { Badge, State } from '../ui/shared';
import { Select } from '../ui/form';

type Tab = 'pulls' | 'branches' | 'commits';

const date = (value: string) =>
  value ? new Date(value).toLocaleDateString() : '';

/** A list row that acts as a toggle button when the list is selectable. */
function selectable(onSelect: (() => void) | undefined, selected: boolean) {
  if (!onSelect) return {};
  return {
    className: `selectable ${selected ? 'selected' : ''}`,
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
  };
}

function Pulls({
  projectId,
  selected,
  onSelect,
}: {
  projectId: number;
  selected?: number;
  onSelect?: (pull: GitHubPull) => void;
}) {
  const [state, setState] = useState('open');
  const pulls = useData<GitHubPull[]>(
    `/github/projects/${projectId}/pulls?state=${state}`,
  );
  return (
    <>
      <Segmented
        size="small"
        className="repo-filter"
        value={state}
        onChange={(v) => setState(String(v))}
        options={[
          { label: 'Open', value: 'open' },
          { label: 'Closed', value: 'closed' },
          { label: 'All', value: 'all' },
        ]}
      />
      <State loading={pulls.isLoading} error={pulls.error} />
      {pulls.data?.length === 0 && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={`No ${state === 'all' ? '' : state} pull requests.`}
        />
      )}
      {onSelect && !!pulls.data?.length && (
        <Typography.Text type="secondary" className="repo-hint">
          Select a pull request to generate from the code it changes.
        </Typography.Text>
      )}
      <ul className="repo-list">
        {pulls.data?.map((p) => (
          <li
            key={p.number}
            {...selectable(onSelect && (() => onSelect(p)), selected === p.number)}
          >
            <div className="repo-pull-title">
              {selected === p.number && <CheckCircleFilled />}
              <span>
                <strong>#{p.number}</strong> {p.title}
              </span>
              <a
                href={p.html_url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open pull request #${p.number} on GitHub`}
                title="Open on GitHub"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <ExportOutlined />
              </a>
            </div>
            <div className="repo-meta">
              <Badge
                value={p.draft && p.state === 'open' ? 'draft' : p.state}
              />
              <Typography.Text code>{p.head}</Typography.Text>→
              <Typography.Text code>{p.base}</Typography.Text>
              <span>
                {p.author} · {date(p.updated_at)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function Branches({ repo }: { repo?: GitHubBranches }) {
  if (!repo) return null;
  if (!repo.branches.length)
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="This repository has no branches yet."
      />
    );
  return (
    <ul className="repo-list">
      {repo.branches.map((b) => (
        <li key={b.name}>
          <a
            href={`${repo.html_url}/tree/${b.name}`}
            target="_blank"
            rel="noreferrer"
          >
            <BranchesOutlined /> <strong>{b.name}</strong>
          </a>
          <div className="repo-meta">
            {b.name === repo.default_branch && <Tag color="green">Default</Tag>}
            {b.protected && <Tag>Protected</Tag>}
            <Typography.Text code>{b.sha.slice(0, 7)}</Typography.Text>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Commits({
  projectId,
  repo,
  selected,
  onSelect,
}: {
  projectId: number;
  repo?: GitHubBranches;
  selected?: string;
  onSelect?: (commit: GitHubCommit) => void;
}) {
  const [branch, setBranch] = useState('');
  const current = branch || repo?.default_branch || '';
  const commits = useData<GitHubCommit[]>(
    `/github/projects/${projectId}/commits${current ? `?branch=${encodeURIComponent(current)}` : ''}`,
    !!repo,
  );
  return (
    <>
      <Select
        size="small"
        className="repo-filter repo-branch"
        aria-label="Branch"
        value={current}
        onChange={setBranch}
        options={(repo?.branches ?? []).map((b) => ({
          value: b.name,
          label: b.name,
        }))}
      />
      <State loading={commits.isLoading} error={commits.error} />
      {commits.data?.length === 0 && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No commits on this branch."
        />
      )}
      {onSelect && !!commits.data?.length && (
        <Typography.Text type="secondary" className="repo-hint">
          Select a commit to generate from the code it changes.
        </Typography.Text>
      )}
      <ul className="repo-list">
        {commits.data?.map((c) => (
          <li
            key={c.sha}
            {...selectable(onSelect && (() => onSelect(c)), selected === c.sha)}
          >
            {onSelect ? (
              <div className="repo-pull-title">
                {selected === c.sha && <CheckCircleFilled />}
                <span>{c.message}</span>
                <a
                  href={c.html_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open commit ${c.sha.slice(0, 7)} on GitHub`}
                  title="Open on GitHub"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <ExportOutlined />
                </a>
              </div>
            ) : (
              <a href={c.html_url} target="_blank" rel="noreferrer">
                {c.message}
              </a>
            )}
            <div className="repo-meta">
              <Typography.Text code>{c.sha.slice(0, 7)}</Typography.Text>
              <span>
                {c.author} · {date(c.date)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Pull requests, branches and commits of the project's linked repository. */
export default function RepoActivity({
  project,
  configured,
  selectedPull,
  onSelectPull,
  selectedCommit,
  onSelectCommit,
}: {
  project?: Project;
  configured?: boolean;
  selectedPull?: number;
  onSelectPull?: (pull: GitHubPull) => void;
  selectedCommit?: string;
  onSelectCommit?: (commit: GitHubCommit) => void;
}) {
  const [tab, setTab] = useState<Tab>('pulls');
  const name = repoName(project?.github_repo ?? '');
  const ready = !!project && !!name && configured !== false;
  const repo = useData<GitHubBranches>(
    `/github/projects/${project?.id}/branches`,
    ready,
  );
  return (
    <Card
      className="card repo-activity"
      title={
        <span className="repo-title">
          <GithubOutlined /> {name ?? 'Repository'}
        </span>
      }
      activeTabKey={tab}
      onTabChange={(key) => setTab(key as Tab)}
      tabList={[
        { key: 'pulls', label: 'PRs', icon: <PullRequestOutlined /> },
        { key: 'branches', label: 'Branches', icon: <BranchesOutlined /> },
        { key: 'commits', label: 'Commits', icon: <NodeIndexOutlined /> },
      ]}
    >
      {!name ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <>
              No repository linked. Link one on the{' '}
              <Link to="/github">GitHub</Link> page.
            </>
          }
        />
      ) : configured === false ? (
        <Alert
          type="warning"
          showIcon
          title="GitHub is not connected. Set GITHUB_TOKEN in backend/.env."
        />
      ) : (
        <>
          {tab !== 'pulls' && (
            <State loading={repo.isLoading} error={repo.error} />
          )}
          {tab === 'pulls' && (
            <Pulls
              projectId={project!.id}
              selected={selectedPull}
              onSelect={onSelectPull}
            />
          )}
          {tab === 'branches' && <Branches repo={repo.data} />}
          {tab === 'commits' && (
            <Commits
              projectId={project!.id}
              repo={repo.data}
              selected={selectedCommit}
              onSelect={onSelectCommit}
            />
          )}
        </>
      )}
    </Card>
  );
}
