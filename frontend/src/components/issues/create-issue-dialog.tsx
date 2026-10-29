'use client';

import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useData, useProjects, useSave } from '@/hooks/data';
import { issueTypes, label, priorities, type Issue, type Project, type Sprint } from '@/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Select, type Option } from '@/components/ui/select';
import { Avatar, Note, ProjectMark } from '@/components/ui/display';
import { PriorityIcon, TypeIcon } from '@/components/ui/glyphs';
import { cn } from '@/lib/utils';

const nullable = z.preprocess((v) => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().nullable());
const schema = z.object({
  project_id: z.coerce.number().min(1, 'Choose a project'),
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
const NONE = 0;

export default function CreateIssueDialog({ initial, onClose }: { initial: Partial<Issue>; onClose: () => void }) {
  const projects = useProjects();
  const { control, register, handleSubmit, watch, setValue, formState } = useForm<z.input<typeof schema>, unknown, Values>({
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
  const type = watch('issue_type');
  const project = useData<Project>(`/projects/${pid}`, !!pid);
  const issues = useData<Issue[]>(`/issues?project_id=${pid}`, !!pid);
  const sprints = useData<Sprint[]>(`/projects/${pid}/sprints`, !!pid);
  const save = useSave(initial.id ? `/issues/${initial.id}` : '/issues', initial.id ? 'put' : 'post', initial.id ? 'Issue updated' : 'Issue created');

  /** A select bound to a nullable id field; 0 stands for "none". */
  const pick = (name: 'epic_id' | 'parent_issue_id' | 'assignee_id' | 'sprint_id', options: Option<number>[], ariaLabel: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select<number>
          aria-label={ariaLabel}
          value={(field.value as number | null) ?? NONE}
          onChange={(v) => field.onChange(v === NONE ? null : v)}
          options={options}
        />
      )}
    />
  );

  const submit = handleSubmit(async (data) => {
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
        labels: data.labels.split(',').map((s) => s.trim()).filter(Boolean),
      });
      onClose();
    } catch {
      /* toast shown by useSave */
    }
  });

  const errors = Object.values(formState.errors).map((e) => e?.message).filter(Boolean);
  return (
    <Dialog
      onClose={onClose}
      width={720}
      title={initial.id ? 'Edit issue' : initial.related_test_case_id ? 'Create bug' : 'Create issue'}
      description={initial.id ? undefined : 'New issues start in the backlog, or To do in an active sprint.'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            {initial.id ? 'Save changes' : 'Create issue'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {initial.related_test_case_id && (
          <Note tone="indigo">
            Linked story: {issues.data?.find((i) => i.id === initial.related_issue_id)?.issue_key ?? initial.related_issue_id} · Test case #
            {initial.related_test_case_id}
            {initial.related_execution_id && ` · Test run #${initial.related_execution_id}`}
          </Note>
        )}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Project">
            {(id) => (
              <Select<number>
                id={id}
                value={pid || null}
                placeholder="Select project"
                disabled={!!initial.id}
                onChange={(v) => {
                  setValue('project_id', v);
                  for (const f of ['epic_id', 'parent_issue_id', 'sprint_id', 'assignee_id'] as const) setValue(f, null);
                }}
                options={(projects.data ?? []).map((p) => ({ value: p.id, label: p.name, icon: <ProjectMark project={p} size={16} /> }))}
              />
            )}
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium">Issue type</span>
            <Controller
              control={control}
              name="issue_type"
              render={({ field }) => (
                <div role="radiogroup" aria-label="Issue type" className="flex flex-wrap gap-1">
                  {issueTypes.map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={field.value === t}
                      disabled={!!initial.id}
                      onClick={() => field.onChange(t)}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-ink-2 hover:bg-hover disabled:opacity-60',
                        field.value === t && 'bg-hover text-ink ring-1 ring-line-2',
                      )}
                    >
                      <TypeIcon type={t} size={15} />
                      {label(t)}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>
        </div>
        <Field label="Summary">{(id) => <Input id={id} size="lg" autoFocus className="text-[15px] font-medium" {...register('summary')} />}</Field>
        <Field
          label={
            <span className="flex w-full items-center justify-between">
              Description <span className="font-normal text-ink-3">Markdown supported</span>
            </span>
          }
        >
          {(id) => (
            <div className="flex flex-col gap-1.5">
              <Textarea id={id} rows={5} placeholder="Describe the work, context, and expected outcome…" {...register('description')} />
              {type === 'STORY' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="self-start"
                  onClick={() => setValue('description', 'As a [user],\nI want [feature],\nSo that [business value].')}
                >
                  Use user story template
                </Button>
              )}
            </div>
          )}
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Priority">
            {() => (
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select
                    aria-label="Priority"
                    value={field.value}
                    onChange={field.onChange}
                    options={priorities.map((p) => ({ value: p, label: label(p), icon: <PriorityIcon priority={p} /> }))}
                  />
                )}
              />
            )}
          </Field>
          <Field label="Assignee">
            {() =>
              pick(
                'assignee_id',
                [
                  { value: NONE, label: 'Unassigned', icon: <Avatar user={null} size={16} /> },
                  ...(project.data?.members ?? []).map((u) => ({ value: u.id, label: `${u.first_name} ${u.last_name}`, icon: <Avatar user={u} size={16} /> })),
                ],
                'Assignee',
              )
            }
          </Field>
          <Field label="Story points">{(id) => <Input id={id} type="number" min={0} {...register('story_points')} />}</Field>
          <Field label="Sprint">
            {() =>
              pick(
                'sprint_id',
                [{ value: NONE, label: 'Backlog' }, ...(sprints.data ?? []).filter((s) => s.status !== 'COMPLETED').map((s) => ({ value: s.id, label: s.name }))],
                'Sprint',
              )
            }
          </Field>
          <Field label="Epic">
            {() =>
              pick(
                'epic_id',
                [
                  { value: NONE, label: 'None' },
                  ...(issues.data ?? []).filter((i) => i.issue_type === 'EPIC' && i.id !== initial.id).map((i) => ({ value: i.id, label: i.summary, icon: <TypeIcon type="EPIC" size={14} /> })),
                ],
                'Epic',
              )
            }
          </Field>
          <Field label="Parent issue (subtasks)">
            {() =>
              pick(
                'parent_issue_id',
                [
                  { value: NONE, label: 'None' },
                  ...(issues.data ?? [])
                    .filter((i) => ['STORY', 'TASK', 'BUG'].includes(i.issue_type) && i.id !== initial.id)
                    .map((i) => ({ value: i.id, label: `${i.issue_key} — ${i.summary}`, text: i.issue_key })),
                ],
                'Parent issue',
              )
            }
          </Field>
        </div>
        <Field label="Labels" hint="Separate with commas">
          {(id) => <Input id={id} placeholder="frontend, leave" {...register('labels')} />}
        </Field>
        {errors.length > 0 && <Note tone="red">{errors.join(' · ')}</Note>}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
