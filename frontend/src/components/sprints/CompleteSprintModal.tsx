import { useState } from 'react';
import { useSave } from '../../hooks/data';
import type { Issue, Sprint } from '../../types';
import { Modal } from '../ui/dialog';
import { Field } from '../ui/shared';
import { Button } from '../ui/button';

/** Completes a sprint, sending unfinished work to the backlog or a planned sprint. */
export default function CompleteSprintModal({
  sprint,
  sprints,
  issues,
  onClose,
}: {
  sprint: Sprint;
  sprints: Sprint[];
  issues: Issue[];
  onClose: () => void;
}) {
  const [target, setTarget] = useState('');
  const complete = useSave(
    `/sprints/${sprint.id}/complete`,
    'post',
    'Sprint completed',
  );
  const items = issues.filter((i) => i.sprint_id === sprint.id);
  const done = items.filter((i) => i.status === 'DONE');
  const open = items.length - done.length;
  const planned = sprints.filter((s) => s.status === 'PLANNED');
  return (
    <Modal open title={`Complete ${sprint.name}`} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await complete.mutateAsync({
              move_to_sprint_id: target ? Number(target) : null,
            });
            onClose();
          } catch {
            /* toast */
          }
        }}
      >
        <p>
          {done.length} completed ·{' '}
          {done.reduce((n, i) => n + i.story_points, 0)} story points.
          <br />
          {open} unfinished item{open === 1 ? '' : 's'}.
        </p>
        {open > 0 && (
          <Field label="Move unfinished work to">
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Backlog</option>
              {planned.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="actions form-footer">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={complete.isPending}>
            Complete sprint
          </Button>
        </div>
      </form>
    </Modal>
  );
}
