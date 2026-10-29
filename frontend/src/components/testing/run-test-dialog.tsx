'use client';

import { useRef, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { useData, useMe, useSave } from '@/hooks/data';
import { label, runStatuses, stepStatuses, type Execution, type Project, type RunStatus, type Sprint, type StepStatus, type TestCase } from '@/types';
import { bugFromRun, fullName, testColor } from '@/lib/qa';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/controls';
import { Note } from '@/components/ui/display';
import { useCreateIssue } from '@/components/layout/context';
import { cn } from '@/lib/utils';

type StepResult = { step_number: number; status: StepStatus; actual_result: string };

/** The overall result a tester would most likely pick from the step results. */
function derive(steps: StepResult[]): RunStatus | '' {
  if (steps.some((s) => s.status === 'FAILED')) return 'FAILED';
  if (steps.some((s) => s.status === 'BLOCKED')) return 'BLOCKED';
  if (steps.length && steps.every((s) => s.status === 'PASSED')) return 'PASSED';
  return '';
}

function ResultPicker<V extends string>({ value, options, onChange, label: aria }: { value: V | ''; options: readonly V[]; onChange: (v: V) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={aria} className="inline-flex rounded-md border border-line-2 bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn('rounded px-2 py-0.5 text-xs font-medium text-ink-2 hover:text-ink', value === o && 'text-white')}
          style={value === o ? { background: testColor[o] } : undefined}
        >
          {label(o)}
        </button>
      ))}
    </div>
  );
}

export default function RunTestDialog({
  testCase: tc,
  execution,
  initialStatus,
  sprintId: defaultSprint,
  onClose,
}: {
  testCase: TestCase;
  execution?: Execution;
  initialStatus?: RunStatus;
  /** Sprint for a new run; defaults to the active sprint. */
  sprintId?: number;
  onClose: () => void;
}) {
  const me = useMe();
  const project = useData<Project>(`/projects/${tc.project_id}`);
  const sprints = useData<Sprint[]>(`/projects/${tc.project_id}/sprints`);
  const create = useCreateIssue();
  const form = useRef<HTMLFormElement>(null);
  const source = execution?.steps ?? tc.steps;
  const [steps, setSteps] = useState<StepResult[]>(() =>
    source.map((s) => ({ step_number: s.step_number, status: 'status' in s ? s.status : 'NOT_RUN', actual_result: 'actual_result' in s ? s.actual_result : '' })),
  );
  const [status, setStatus] = useState<RunStatus | ''>(execution?.status ?? initialStatus ?? '');
  const [chosen, setChosen] = useState(!!execution || !!initialStatus);
  const [tester, setTester] = useState<number | undefined>(execution?.tester_id);
  const [sprintId, setSprintId] = useState<number | null | undefined>(execution ? (execution.sprint_id ?? null) : defaultSprint);
  const [logBug, setLogBug] = useState(true);
  const save = useSave<unknown>(execution ? `/test-executions/${execution.id}` : '/test-executions', execution ? 'put' : 'post', 'Test run saved');
  const members = project.data ? [...project.data.members].sort((a, b) => fullName(a).localeCompare(fullName(b))) : [];
  const openSprints = sprints.data?.filter((s) => s.status !== 'COMPLETED' || s.id === execution?.sprint_id) ?? [];
  const sprint = sprintId !== undefined ? sprintId : (sprints.data?.find((s) => s.status === 'ACTIVE')?.id ?? null);
  const apply = (next: StepResult[]) => {
    setSteps(next);
    if (!chosen) setStatus(derive(next));
  };
  const update = (index: number, change: Partial<StepResult>) => apply(steps.map((s, i) => (i === index ? { ...s, ...change } : s)));
  const submit = async () => {
    if (!status || !form.current?.reportValidity()) return;
    const f = new FormData(form.current);
    try {
      const run = (await save.mutateAsync({
        test_case_id: tc.id,
        status,
        actual_result: f.get('actual_result'),
        environment: f.get('environment'),
        executed_on: f.get('executed_on'),
        tester_id: tester ?? me.data?.id,
        sprint_id: sprint,
        steps,
      })) as Execution;
      onClose();
      if (!execution && status === 'FAILED' && logBug) create(bugFromRun(tc, run));
    } catch {
      /* toast */
    }
  };
  return (
    <Dialog
      width={760}
      onClose={onClose}
      title={`${execution ? 'Test run' : 'Run'} · ${tc.test_case_key}`}
      description={tc.title}
      footer={
        <>
          {!execution && status === 'FAILED' && <Checkbox className="mr-auto" checked={logBug} onChange={setLogBug} label="Log a bug for this failure after saving" />}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} disabled={!status} onClick={submit}>
            Save test run
          </Button>
        </>
      }
    >
      <form
        ref={form}
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {tc.preconditions && <Note tone="blue">Preconditions: {tc.preconditions}</Note>}
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold">Step results</span>
          {!!steps.length && (
            <Button size="sm" variant="ghost" icon={<CheckCheck />} onClick={() => apply(steps.map((s) => ({ ...s, status: 'PASSED' })))}>
              Mark all steps passed
            </Button>
          )}
        </div>
        {!steps.length && <p className="text-[12.5px] text-ink-3">This test case has no steps. Record the overall result below.</p>}
        {!!steps.length && (
          <div className="overflow-hidden rounded-lg border border-line">
            {source.map((s, index) => (
              <div key={s.step_number} className="flex gap-3 border-b border-line px-3 py-3 last:border-b-0" style={{ boxShadow: `inset 3px 0 0 ${testColor[steps[index].status]}` }}>
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-hover text-xs font-semibold text-ink-2">{s.step_number}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="text-[13px]">
                    <p className="font-medium">{s.action}</p>
                    {s.test_data && <p className="whitespace-pre-wrap text-xs text-ink-3">Data: {s.test_data}</p>}
                    <p className="text-xs text-ink-3">Expected: {s.expected_result || '—'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ResultPicker label={`Step ${s.step_number} result`} value={steps[index].status} options={stepStatuses} onChange={(v) => update(index, { status: v })} />
                    <Input
                      size="sm"
                      className="min-w-[180px] flex-1"
                      aria-label={`Step ${s.step_number} actual result`}
                      placeholder="Actual result"
                      value={steps[index].actual_result}
                      onChange={(e) => update(index, { actual_result: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium">Overall result</span>
          <ResultPicker
            label="Overall result"
            value={status}
            options={runStatuses}
            onChange={(v) => {
              setStatus(v);
              setChosen(true);
            }}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Tester">
            {(id) => <Select<number> id={id} value={tester ?? me.data?.id} onChange={setTester} options={members.map((u) => ({ value: u.id, label: fullName(u) }))} />}
          </Field>
          <Field label="Execution date">
            {(id) => <Input id={id} type="date" name="executed_on" required defaultValue={execution?.executed_on ?? new Date().toLocaleDateString('en-CA')} />}
          </Field>
          <Field label="Sprint">
            {(id) => (
              <Select<number>
                id={id}
                value={sprint ?? 0}
                onChange={(v) => setSprintId(v || null)}
                options={[{ value: 0, label: 'No sprint' }, ...openSprints.map((s) => ({ value: s.id, label: `${s.name}${s.status === 'ACTIVE' ? ' (active)' : ''}` }))]}
              />
            )}
          </Field>
        </div>
        <Field label="Environment">{(id) => <Input id={id} name="environment" maxLength={100} placeholder="e.g. Staging, Chrome 130" defaultValue={execution?.environment} />}</Field>
        <Field label="Actual result">{(id) => <Textarea id={id} name="actual_result" rows={3} placeholder="What happened when you ran the test?" defaultValue={execution?.actual_result} />}</Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
