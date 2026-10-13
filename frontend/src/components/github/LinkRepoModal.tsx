import { useState } from 'react';
import { useData, useSave } from '../../hooks/data';
import { Modal } from '../ui/dialog';
import { Field } from '../ui/shared';
import { Button } from '../ui/button';
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
          <select
            required
            value={projectId ?? ''}
            onChange={(e) => {
              setProjectId(Number(e.target.value));
              setChosen(undefined);
            }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.key}
                {repoName(p.github_repo)
                  ? ` (linked to ${repoName(p.github_repo)})`
                  : ''}
              </option>
            ))}
          </select>
        </Field>
        {current && (
          <p className="muted">
            Linking a different repository replaces <strong>{current}</strong>{' '}
            for this project.
          </p>
        )}
        <fieldset className="field">
          <span>Available repositories</span>
          <input
            type="search"
            aria-label="Search repositories"
            placeholder="Search repositories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {repos.isLoading && (
            <p className="muted">Loading repositories from GitHub…</p>
          )}
          {repos.error && (
            <p className="error">
              Unable to load repositories. Check that GitHub is connected.
            </p>
          )}
          {repos.data && !shown.length && (
            <p className="muted">
              {repos.data.length
                ? 'No repositories match your search.'
                : 'The connected GitHub account has no repositories.'}
            </p>
          )}
          {shown.length > 0 && (
            <div className="pick-list" role="radiogroup">
              {shown.map((r) => (
                <label className="check-row repo-option" key={r.full_name}>
                  <input
                    type="radio"
                    name="repository"
                    checked={chosen === r.full_name}
                    onChange={() => setChosen(r.full_name)}
                  />
                  <span>
                    <strong>{r.full_name}</strong>
                    {r.private && <span className="badge">Private</span>}
                    {r.full_name === current && (
                      <span className="badge badge-active">Linked</span>
                    )}
                    <br />
                    <span className="muted">
                      {r.linked_projects.length
                        ? `Linked to ${r.linked_projects.join(', ')}`
                        : r.description || `Default branch ${r.default_branch}`}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <div className="actions form-footer">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!chosen || chosen === current || link.isPending}
          >
            Link
          </Button>
        </div>
      </form>
    </Modal>
  );
}
