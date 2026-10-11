import { useSave } from '../../hooks/data';
import type { Sprint, Issue } from '../../types';
import { Modal } from '../ui/dialog';
import { Field } from '../ui/shared';
import { Button } from '../ui/button';
export default function SprintModal({
  projectId,
  sprint,
  start = false,
  issues = [],
  onClose,
}: {
  projectId: number;
  sprint?: Sprint;
  start?: boolean;
  issues?: Issue[];
  onClose: () => void;
}) {
  const save = useSave(
    sprint ? `/sprints/${sprint.id}` : `/projects/${projectId}/sprints`,
    sprint ? 'put' : 'post',
    start ? '' : 'Sprint saved',
  );
  const begin = useSave(
    `/sprints/${sprint?.id}/start`,
    'post',
    'Sprint started',
  );
  return (
    <Modal
      open
      title={start ? 'Start sprint' : sprint ? 'Edit sprint' : 'Create sprint'}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          try {
            await save.mutateAsync({
              name: form.get('name'),
              goal: form.get('goal'),
              start_date: form.get('start_date') || null,
              end_date: form.get('end_date') || null,
              capacity: Number(form.get('capacity')),
            });
            if (start) await begin.mutateAsync({});
            onClose();
          } catch {
            /*toast*/
          }
        }}
      >
        <Field label="Sprint name">
          <input name="name" required defaultValue={sprint?.name} />
        </Field>
        <Field label="Sprint goal">
          <textarea name="goal" defaultValue={sprint?.goal} />
        </Field>
        <div className="form-grid">
          <Field label="Start date">
            <input
              name="start_date"
              type="date"
              required={start}
              defaultValue={sprint?.start_date ?? ''}
            />
          </Field>
          <Field label="End date">
            <input
              name="end_date"
              type="date"
              required={start}
              defaultValue={sprint?.end_date ?? ''}
            />
          </Field>
        </div>
        <Field label="Capacity · story points">
          <input
            type="number"
            name="capacity"
            min="1"
            required
            defaultValue={sprint?.capacity ?? 30}
          />
        </Field>
        {start && (
          <p>
            {issues.length} issues ·{' '}
            {issues.reduce((n, i) => n + i.story_points, 0)} story points
          </p>
        )}
        <div className="actions form-footer">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending || begin.isPending}>
            {start ? 'Start sprint' : 'Save sprint'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
