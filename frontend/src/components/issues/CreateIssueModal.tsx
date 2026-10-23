import { Controller, useForm } from 'react-hook-form';
import { Alert, Input } from 'antd';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useData, useProjects, useSave } from '../../hooks/data';
import {
  issueTypes,
  priorities,
  type Issue,
  type Project,
  type Sprint,
} from '../../types';
import { Modal } from '../ui/dialog';
import { Button } from '../ui/button';
import { Field } from '../ui/shared';
import { Select, labelled, type Option } from '../ui/form';
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
    control,
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
  /** A select bound to one form field. */
  const pick = (
    name:
      'epic_id' | 'parent_issue_id' | 'assignee_id' | 'priority' | 'sprint_id',
    options: Option[],
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select
          value={field.value}
          onChange={field.onChange}
          options={options}
        />
      )}
    />
  );
  /** A text input bound to one form field. */
  const text = (name: 'summary' | 'labels', autoFocus = false) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <Input autoFocus={autoFocus} {...field} />}
    />
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
                    related_execution_id: initial.related_execution_id,
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
          <Alert
            className="linked-context"
            type="info"
            title={
              <>
                Linked story:{' '}
                {issues.data?.find((i) => i.id === initial.related_issue_id)
                  ?.issue_key ?? initial.related_issue_id}
                {' · '}Test case #{initial.related_test_case_id}
                {initial.related_execution_id &&
                  ` · Test run #${initial.related_execution_id}`}
              </>
            }
          />
        )}
        <div className="form-grid">
          <Field label="Project">
            <Select
              value={pid || null}
              placeholder="Select project"
              disabled={!!initial.id}
              onChange={(v) => {
                setValue('project_id', Number(v));
                for (const field of [
                  'epic_id',
                  'parent_issue_id',
                  'sprint_id',
                  'assignee_id',
                ] as const)
                  setValue(field, null);
              }}
              options={(projects.data ?? []).map((p) => ({
                value: p.id,
                label: p.name,
              }))}
            />
          </Field>
          <Field label="Issue type">
            <Controller
              control={control}
              name="issue_type"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onChange={field.onChange}
                  disabled={!!initial.id}
                  options={labelled(issueTypes)}
                />
              )}
            />
          </Field>
        </div>
        <Field label="Summary">{text('summary', true)}</Field>
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
          <Controller
            control={control}
            name="description"
            render={({ field }) => (
              <Input.TextArea
                rows={4}
                {...field}
                placeholder="Describe the work, context, and expected outcome…"
              />
            )}
          />
        </Field>
        <div className="form-grid">
          <Field label="Epic">
            {pick('epic_id', [
              { value: '', label: 'None' },
              ...(issues.data ?? [])
                .filter((i) => i.issue_type === 'EPIC' && i.id !== initial.id)
                .map((i) => ({ value: i.id, label: i.summary })),
            ])}
          </Field>
          <Field label="Parent issue (subtasks)">
            {pick('parent_issue_id', [
              { value: '', label: 'None' },
              ...(issues.data ?? [])
                .filter(
                  (i) =>
                    ['STORY', 'TASK', 'BUG'].includes(i.issue_type) &&
                    i.id !== initial.id,
                )
                .map((i) => ({
                  value: i.id,
                  label: `${i.issue_key} — ${i.summary}`,
                })),
            ])}
          </Field>
          <Field label="Assignee">
            {pick('assignee_id', [
              { value: '', label: 'Unassigned' },
              ...(project.data?.members ?? []).map((u) => ({
                value: u.id,
                label: `${u.first_name} ${u.last_name}`,
              })),
            ])}
          </Field>
          <Field label="Priority">
            {pick('priority', labelled(priorities))}
          </Field>
          <Field label="Story points">
            <Controller
              control={control}
              name="story_points"
              render={({ field }) => <Input type="number" min="0" {...field} />}
            />
          </Field>
          <Field label="Sprint">
            {pick('sprint_id', [
              { value: '', label: 'Backlog' },
              ...(sprints.data ?? [])
                .filter((s) => s.status !== 'COMPLETED')
                .map((s) => ({ value: s.id, label: s.name })),
            ])}
          </Field>
        </div>
        <Field label="Labels · separated by commas">{text('labels')}</Field>
        {Object.values(errors).map((e, i) => (
          <p className="error" key={i}>
            {e.message}
          </p>
        ))}
        <div className="actions form-footer">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            {initial.id ? 'Save changes' : 'Create issue'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
