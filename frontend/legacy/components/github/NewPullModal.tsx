import { useState } from 'react';
import { Checkbox, Input } from 'antd';
import { useSave } from '../../hooks/data';
import { Modal } from '../ui/dialog';
import { Field } from '../ui/shared';
import { Button } from '../ui/button';
import { Select } from '../ui/form';
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
  const [draft, setDraft] = useState(false);
  const names = repo.branches.map((b) => b.name);
  const branches = names.map((n) => ({ value: n, label: n }));
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
              draft,
            });
            onClose();
          } catch {
            /* toast */
          }
        }}
      >
        <div className="form-grid">
          <Field label="Merge from (head)">
            <Select
              name="head"
              defaultValue={firstHead}
              required
              options={branches}
            />
          </Field>
          <Field label="Into (base)">
            <Select
              name="base"
              defaultValue={repo.default_branch}
              required
              options={branches}
            />
          </Field>
        </div>
        <Field label="Title">
          <Input name="title" required maxLength={256} />
        </Field>
        <Field label="Description">
          <Input.TextArea
            name="body"
            rows={4}
            placeholder="What changed and why"
          />
        </Field>
        <Checkbox
          className="check-row"
          checked={draft}
          onChange={(e) => setDraft(e.target.checked)}
        >
          Open as a draft
        </Checkbox>
        <div className="actions form-footer">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            Open pull request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
