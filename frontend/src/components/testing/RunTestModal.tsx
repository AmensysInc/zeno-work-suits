import { useState } from 'react';
import { useData, useMe, useSave } from '../../hooks/data';
import {
  label,
  runStatuses,
  stepStatuses,
  type Execution,
  type Project,
  type RunStatus,
  type Sprint,
  type StepStatus,
  type TestCase,
} from '../../types';
import { bugFromRun, fullName } from '../../lib/qa';
import { Modal } from '../ui/dialog';
import { Button } from '../ui/button';
import { Field } from '../ui/shared';
import { useCreateIssue } from '../layout/AppShell';

type StepResult = {
  step_number: number;
  status: StepStatus;
  actual_result: string;
};

/** The overall result a tester would most likely pick from the step results. */
function derive(steps: StepResult[]): RunStatus | '' {
  if (steps.some((s) => s.status === 'FAILED')) return 'FAILED';
  if (steps.some((s) => s.status === 'BLOCKED')) return 'BLOCKED';
  if (steps.length && steps.every((s) => s.status === 'PASSED'))
    return 'PASSED';
  return '';
}

export default function RunTestModal({
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
  const source = execution?.steps ?? tc.steps;
  const [steps, setSteps] = useState<StepResult[]>(() =>
    source.map((s) => ({
      step_number: s.step_number,
      status: 'status' in s ? s.status : 'NOT_RUN',
      actual_result: 'actual_result' in s ? s.actual_result : '',
    })),
  );
  const [status, setStatus] = useState<RunStatus | ''>(
    execution?.status ?? initialStatus ?? '',
  );
  const [chosen, setChosen] = useState(!!execution || !!initialStatus);
  const [tester, setTester] = useState<number | undefined>(
    execution?.tester_id,
  );
  const [sprintId, setSprintId] = useState<number | '' | undefined>(
    execution ? (execution.sprint_id ?? '') : defaultSprint,
  );
  const [logBug, setLogBug] = useState(true);
  const save = useSave<unknown>(
    execution ? `/test-executions/${execution.id}` : '/test-executions',
    execution ? 'put' : 'post',
    'Test run saved',
  );
  const members = project.data
    ? [...project.data.members].sort((a, b) =>
        fullName(a).localeCompare(fullName(b)),
      )
    : [];
  const openSprints =
    sprints.data?.filter(
      (s) => s.status !== 'COMPLETED' || s.id === execution?.sprint_id,
    ) ?? [];
  const sprint =
    sprintId ?? sprints.data?.find((s) => s.status === 'ACTIVE')?.id ?? '';
  const apply = (next: StepResult[]) => {
    setSteps(next);
    if (!chosen) setStatus(derive(next));
  };
  const update = (index: number, change: Partial<StepResult>) =>
    apply(steps.map((s, i) => (i === index ? { ...s, ...change } : s)));
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`${execution ? 'Test run' : 'Run'} · ${tc.test_case_key} ${tc.title}`}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!status) return;
          const form = new FormData(e.currentTarget);
          try {
            const run = (await save.mutateAsync({
              test_case_id: tc.id,
              status,
              actual_result: form.get('actual_result'),
              environment: form.get('environment'),
              executed_on: form.get('executed_on'),
              tester_id: tester ?? me.data?.id,
              sprint_id: sprint === '' ? null : sprint,
              steps,
            })) as Execution;
            onClose();
            if (!execution && status === 'FAILED' && logBug)
              create(bugFromRun(tc, run));
          } catch {
            /* toast */
          }
        }}
      >
        {tc.preconditions && (
          <p className="linked-context">Preconditions: {tc.preconditions}</p>
        )}
        <div className="section-head">
          <h3>Step results</h3>
          {!!steps.length && (
            <Button
              variant="ghost"
              onClick={() =>
                apply(steps.map((s) => ({ ...s, status: 'PASSED' })))
              }
            >
              Mark all steps passed
            </Button>
          )}
        </div>
        {!steps.length && (
          <p className="muted">
            This test case has no steps. Record the overall result below.
          </p>
        )}
        <div className="run-steps">
          {source.map((s, index) => (
            <div
              className={`run-step run-${steps[index].status.toLowerCase()}`}
              key={s.step_number}
            >
              <span className="run-number">{s.step_number}</span>
              <div>
                <p>{s.action}</p>
                {s.test_data && (
                  <p className="muted prewrap">Data: {s.test_data}</p>
                )}
                <p className="muted">Expected: {s.expected_result || '—'}</p>
              </div>
              <div className="run-inputs">
                <select
                  aria-label={`Step ${s.step_number} result`}
                  value={steps[index].status}
                  onChange={(e) =>
                    update(index, { status: e.target.value as StepStatus })
                  }
                >
                  {stepStatuses.map((v) => (
                    <option key={v} value={v}>
                      {label(v)}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Step ${s.step_number} actual result`}
                  placeholder="Actual result"
                  value={steps[index].actual_result}
                  onChange={(e) =>
                    update(index, { actual_result: e.target.value })
                  }
                />
              </div>
            </div>
          ))}
        </div>
        <div className="form-grid">
          <Field label="Overall result">
            <select
              required
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as RunStatus);
                setChosen(true);
              }}
            >
              <option value="">Select a result</option>
              {runStatuses.map((v) => (
                <option key={v} value={v}>
                  {label(v)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tester">
            <select
              value={tester ?? me.data?.id ?? ''}
              onChange={(e) => setTester(Number(e.target.value))}
            >
              {members.map((u) => (
                <option key={u.id} value={u.id}>
                  {fullName(u)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Execution date">
            <input
              type="date"
              name="executed_on"
              required
              defaultValue={
                execution?.executed_on ?? new Date().toLocaleDateString('en-CA')
              }
            />
          </Field>
          <Field label="Sprint">
            <select
              value={sprint}
              onChange={(e) =>
                setSprintId(e.target.value ? Number(e.target.value) : '')
              }
            >
              <option value="">No sprint</option>
              {openSprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.status === 'ACTIVE' ? ' (active)' : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Environment">
          <input
            name="environment"
            maxLength={100}
            placeholder="e.g. Staging, Chrome 130"
            defaultValue={execution?.environment}
          />
        </Field>
        <Field label="Actual result">
          <textarea
            name="actual_result"
            rows={3}
            placeholder="What happened when you ran the test?"
            defaultValue={execution?.actual_result}
          />
        </Field>
        {!execution && status === 'FAILED' && (
          <label className="check-row">
            <input
              type="checkbox"
              checked={logBug}
              onChange={(e) => setLogBug(e.target.checked)}
            />
            Log a bug for this failure after saving
          </label>
        )}
        <div className="actions form-footer">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending || !status}>
            {save.isPending ? 'Saving…' : 'Save test run'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
