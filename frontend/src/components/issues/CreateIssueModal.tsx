import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useData, useProjects, useSave } from '../../hooks/data';
import {
  issueTypes,
  priorities,
  label,
  type Issue,
  type Project,
  type Sprint,
} from '../../types';
import { Modal } from '../ui/dialog';
import { Button } from '../ui/button';
import { Field } from '../ui/shared';
const nullable = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number().nullable(),
);
const schema = z.object({
  project_id: z.coerce.number().min(1),
  issue_type: z.enum(issueTypes),
  summary: z.string().trim().min(1, 'Summary is required').max(300),
  description: z.string(),
  priority: z.enum(priorities),
  assignee_id: nullable,
  epic_id: nullable,
  parent_issue_id: nullable,
  sprint_id: nullable,
  story_points: z.coerce.number().min(0).max(1000),
  labels: z.string(),
});
type Values = z.infer<typeof schema>;
export default function CreateIssueModal({
  initial,
  onClose,
}: {
  initial: Partial<Issue>;
  onClose: () => void;
}) {
  const projects = useProjects();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      project_id: initial.project_id ?? projects.data?.[0]?.id,
      issue_type: initial.issue_type ?? 'STORY',
      summary: initial.summary ?? '',
      description: initial.description ?? '',
      priority: initial.priority ?? 'MEDIUM',
      story_points: initial.story_points ?? 0,
      labels: initial.labels?.join(', ') ?? '',
      parent_issue_id: initial.parent_issue_id ?? null,
      epic_id: initial.epic_id ?? null,
      sprint_id: initial.sprint_id ?? null,
      assignee_id: initial.assignee_id ?? null,
    },
  });
  const pid = Number(watch('project_id'));
  const project = useData<Project>(`/projects/${pid}`, !!pid);
  const issues = useData<Issue[]>(`/issues?project_id=${pid}`, !!pid);
  const sprints = useData<Sprint[]>(`/projects/${pid}/sprints`, !!pid);
  const save = useSave(
    initial.id ? `/issues/${initial.id}` : '/issues',
    initial.id ? 'put' : 'post',
    initial.id ? 'Issue updated' : 'Issue created',
  );
  return (
    <Modal
      open
      onClose={onClose}
      title={
        initial.id
          ? 'Edit issue'
          : initial.related_test_case_id
            ? 'Create bug'
            : 'Create issue'
      }
    >
      <form
        onSubmit={handleSubmit(async (data) => {
          try {
            const { project_id, issue_type, ...rest } = data;
            await save.mutateAsync({
              ...rest,
              ...(!initial.id
                ? {
                    project_id,
                    issue_type,
                    related_issue_id: initial.related_issue_id,
                    related_test_case_id: initial.related_test_case_id,
                  }
                : {}),
              labels: data.labels
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            });
            onClose();
          } catch {
            /* toast */
          }
        })}
      >
        {initial.related_test_case_id && (
          <p className="linked-context">
            Linked story:{' '}
            {issues.data?.find((i) => i.id === initial.related_issue_id)
              ?.issue_key ?? initial.related_issue_id}
            {' · '}Test case #{initial.related_test_case_id}
          </p>
        )}
        <div className="form-grid">
          <Field label="Project">
            <select
              {...register('project_id')}
              disabled={!!initial.id}
              onChange={(e) => {
                setValue('project_id', Number(e.target.value));
                for (const field of [
                  'epic_id',
                  'parent_issue_id',
                  'sprint_id',
                  'assignee_id',
                ] as const)
                  setValue(field, null);
              }}
            >
              <option value="">Select project</option>
              {projects.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Issue type">
            <select {...register('issue_type')} disabled={!!initial.id}>
              {issueTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Summary">
          <input autoFocus {...register('summary')} />
        </Field>
        {watch('issue_type') === 'STORY' && (
          <Button
            variant="ghost"
            onClick={() =>
              setValue(
                'description',
                `As a [user],
I want [feature],
So that [business value].`,
              )
            }
          >
            Use user story template
          </Button>
        )}
        <Field label="Description · Markdown supported">
          <textarea
            rows={4}
            {...register('description')}
            placeholder="Describe the work, context, and expected outcome…"
          />
        </Field>
        <div className="form-grid">
          <Field label="Epic">
            <select {...register('epic_id')}>
              <option value="">None</option>
              {issues.data
                ?.filter((i) => i.issue_type === 'EPIC' && i.id !== initial.id)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.summary}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Parent issue (subtasks)">
            <select {...register('parent_issue_id')}>
              <option value="">None</option>
              {issues.data
                ?.filter(
                  (i) =>
                    ['STORY', 'TASK', 'BUG'].includes(i.issue_type) &&
                    i.id !== initial.id,
                )
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.issue_key} — {i.summary}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Assignee">
            <select {...register('assignee_id')}>
              <option value="">Unassigned</option>
              {project.data?.members.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select {...register('priority')}>
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {label(p)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Story points">
            <input type="number" min="0" {...register('story_points')} />
          </Field>
          <Field label="Sprint">
            <select {...register('sprint_id')}>
              <option value="">Backlog</option>
              {sprints.data
                ?.filter((s) => s.status !== 'COMPLETED')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <Field label="Labels · separated by commas">
          <input {...register('labels')} />
        </Field>
        {Object.values(errors).map((e, i) => (
          <p className="error" key={i}>
            {e.message}
          </p>
        ))}
        <div className="actions form-footer">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending
              ? 'Saving…'
              : initial.id
                ? 'Save changes'
                : 'Create issue'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
