import { useState } from 'react';
import { Alert, Input, Radio, Tag } from 'antd';
import { useData, useSave } from '../../hooks/data';
import { Modal } from '../ui/dialog';
import { Field } from '../ui/shared';
import { Button } from '../ui/button';
import { Select } from '../ui/form';
import { repoName, type GitHubRepo, type Project } from '../../types';

export default function LinkRepoModal({
  projects,
  initialProject,
  onLinked,
  onClose,
}: {
  projects: Project[];
  initialProject?: number;
  onLinked: (projectId: number) => void;
  onClose: () => void;
}) {
  const repos = useData<GitHubRepo[]>('/github/repos');
  const [projectId, setProjectId] = useState(initialProject ?? projects[0]?.id);
  const project = projects.find((p) => p.id === projectId);
  const current = project ? repoName(project.github_repo) : undefined;
  const [chosen, setChosen] = useState<string>();
  const [search, setSearch] = useState('');
  const link = useSave<{ full_name: string }>(
    `/github/projects/${projectId}/repository`,
    'put',
    'Repository linked',
  );
  const shown = (repos.data ?? []).filter((r) =>
    `${r.full_name} ${r.description}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <Modal open title="Link repository" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!chosen || !projectId) return;
          try {
            await link.mutateAsync({ full_name: chosen });
            onLinked(projectId);
            onClose();
          } catch {
            /* toast */
          }
        }}
      >
        <Field label="Project">
          <Select
            value={projectId}
            onChange={(v) => {
              setProjectId(Number(v));
              setChosen(undefined);
            }}
            options={projects.map((p) => ({
              value: p.id,
              label: `${p.name} · ${p.key}${
                repoName(p.github_repo)
                  ? ` (linked to ${repoName(p.github_repo)})`
                  : ''
              }`,
            }))}
          />
        </Field>
        {current && (
          <p className="muted">
            Linking a different repository replaces <strong>{current}</strong>{' '}
            for this project.
          </p>
        )}
        <fieldset className="field">
          <span>Available repositories</span>
          <Input.Search
            allowClear
            aria-label="Search repositories"
            placeholder="Search repositories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {repos.isLoading && (
            <p className="muted">Loading repositories from GitHub…</p>
          )}
          {repos.error && (
            <Alert
              type="error"
              title="Unable to load repositories. Check that GitHub is connected."
            />
          )}
          {repos.data && !shown.length && (
            <p className="muted">
              {repos.data.length
                ? 'No repositories match your search.'
                : 'The connected GitHub account has no repositories.'}
            </p>
          )}
          {shown.length > 0 && (
            <Radio.Group
              className="pick-list"
              value={chosen}
              onChange={(e) => setChosen(e.target.value)}
            >
              {shown.map((r) => (
                <Radio
                  className="check-row repo-option"
                  key={r.full_name}
                  value={r.full_name}
                >
                  <span>
                    <strong>{r.full_name}</strong>{' '}
                    {r.private && <Tag>Private</Tag>}
                    {r.full_name === current && <Tag color="green">Linked</Tag>}
                    <br />
                    <span className="muted">
                      {r.linked_projects.length
                        ? `Linked to ${r.linked_projects.join(', ')}`
                        : r.description || `Default branch ${r.default_branch}`}
                    </span>
                  </span>
                </Radio>
              ))}
            </Radio.Group>
          )}
        </fieldset>
        <div className="actions form-footer">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={link.isPending}
            disabled={!chosen || chosen === current}
          >
            Link
          </Button>
        </div>
      </form>
    </Modal>
  );
}
