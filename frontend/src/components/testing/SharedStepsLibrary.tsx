import { useState } from 'react';
import { useData, useSave } from '../../hooks/data';
import type { SharedStep } from '../../types';
import { Field, State } from '../ui/shared';
import { Button } from '../ui/button';
import { Modal } from '../ui/dialog';

function StepEditor({
  projectId,
  step,
  onClose,
}: {
  projectId: number;
  step?: SharedStep;
  onClose: () => void;
}) {
  const save = useSave(
    step ? `/shared-steps/${step.id}` : '/shared-steps',
    step ? 'put' : 'post',
    'Reusable step saved',
  );
  return (
    <Modal
      open
      onClose={onClose}
      title={step ? 'Edit reusable step' : 'New reusable step'}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await save.mutateAsync({
              project_id: projectId,
              ...Object.fromEntries(new FormData(e.currentTarget)),
            });
            onClose();
          } catch {
            /* toast */
          }
        }}
      >
        {!!step?.usage_count && (
          <p className="linked-context">
            Used in {step.usage_count} test case
            {step.usage_count === 1 ? '' : 's'}. Saving updates all of them.
          </p>
        )}
        <Field label="Name">
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={step?.title}
          />
        </Field>
        <Field label="Action">
          <textarea name="action" required defaultValue={step?.action} />
        </Field>
        <Field label="Test data">
          <textarea name="test_data" defaultValue={step?.test_data} />
        </Field>
        <Field label="Expected result">
          <textarea
            name="expected_result"
            defaultValue={step?.expected_result}
          />
        </Field>
        <div className="actions form-footer">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            Save step
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteStep({ step }: { step: SharedStep }) {
  const del = useSave(
    `/shared-steps/${step.id}`,
    'delete',
    'Reusable step deleted',
  );
  return (
    <Button
      variant="ghost"
      disabled={del.isPending}
      onClick={() => {
        if (
          window.confirm(
            step.usage_count
              ? `Delete "${step.title}"? The ${step.usage_count} test case(s) using it keep their own copy.`
              : `Delete "${step.title}"?`,
          )
        )
          del.mutate({});
      }}
    >
      Delete
    </Button>
  );
}

export default function SharedStepsLibrary({
  projectId,
}: {
  projectId: number;
}) {
  const query = useData<SharedStep[]>(`/shared-steps?project_id=${projectId}`);
  const [editing, setEditing] = useState<SharedStep | 'new' | null>(null);
  const items = query.data ?? [];
  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>Reusable steps</h2>
          <p className="muted">
            Write common steps once, such as signing in, and insert them into
            any test case. Edits apply everywhere they are used.
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>+ New reusable step</Button>
      </div>
      <State
        loading={query.isLoading}
        error={query.error}
        empty={!query.isLoading && !items.length}
      />
      {!!items.length && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Action</th>
                <th>Test data</th>
                <th>Expected result</th>
                <th>Used in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <button className="link" onClick={() => setEditing(s)}>
                      {s.title}
                    </button>
                  </td>
                  <td className="wrap">{s.action}</td>
                  <td className="wrap muted">{s.test_data || '—'}</td>
                  <td className="wrap">{s.expected_result || '—'}</td>
                  <td className="muted">
                    {s.usage_count} test{s.usage_count === 1 ? '' : 's'}
                  </td>
                  <td>
                    <DeleteStep step={s} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <StepEditor
          projectId={projectId}
          step={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
