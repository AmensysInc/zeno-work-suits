import { useSave } from '../../hooks/data';
import { Modal } from '../ui/dialog';
import { Field } from '../ui/shared';
import { Button } from '../ui/button';
import type { GitHubBranches } from '../../types';

export default function NewPullModal({
  projectId,
  repo,
  head,
  onClose,
}: {
  projectId: number;
  repo: GitHubBranches;
  head?: string;
  onClose: () => void;
}) {
  const save = useSave(
    `/github/projects/${projectId}/pulls`,
    'post',
    'Pull request opened',
  );
  const names = repo.branches.map((b) => b.name);
  const firstHead =
    head ?? names.find((n) => n !== repo.default_branch) ?? names[0];
  return (
    <Modal open title="New pull request" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          try {
            await save.mutateAsync({
              title: form.get('title'),
              head: form.get('head'),
              base: form.get('base'),
              body: form.get('body'),
              draft: form.get('draft') === 'on',
            });
            onClose();
          } catch {
            /* toast */
          }
        }}
      >
        <div className="form-grid">
          <Field label="Merge from (head)">
            <select name="head" defaultValue={firstHead} required>
              {names.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
          <Field label="Into (base)">
            <select name="base" defaultValue={repo.default_branch} required>
              {names.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Title">
          <input name="title" required maxLength={256} />
        </Field>
        <Field label="Description">
          <textarea name="body" placeholder="What changed and why" />
        </Field>
        <label className="check-row">
          <input type="checkbox" name="draft" /> Open as a draft
        </label>
        <div className="actions form-footer">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            Open pull request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
