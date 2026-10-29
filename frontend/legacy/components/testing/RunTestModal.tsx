import { useState } from 'react';
import { Alert, Checkbox, Input, Typography } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { useData, useMe, useSave } from '../../hooks/data';
import {
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
import { DateInput, Select, labelled } from '../ui/form';
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
          <Alert
            className="linked-context"
            type="info"
            title={`Preconditions: ${tc.preconditions}`}
          />
        )}
        <div className="section-head">
          <Typography.Title level={5}>Step results</Typography.Title>
          {!!steps.length && (
            <Button
              variant="ghost"
              icon={<CheckOutlined />}
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
                <Select
                  aria-label={`Step ${s.step_number} result`}
                  value={steps[index].status}
                  onChange={(v) => update(index, { status: v as StepStatus })}
                  options={labelled(stepStatuses)}
                />
                <Input
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
            <Select
              required
              placeholder="Select a result"
              value={status}
              onChange={(v) => {
                setStatus(v as RunStatus);
                setChosen(true);
              }}
              options={labelled(runStatuses)}
            />
          </Field>
          <Field label="Tester">
            <Select
              value={tester ?? me.data?.id ?? ''}
              onChange={(v) => setTester(Number(v))}
              options={members.map((u) => ({
                value: u.id,
                label: fullName(u),
              }))}
            />
          </Field>
          <Field label="Execution date">
            <DateInput
              name="executed_on"
              required
              defaultValue={
                execution?.executed_on ?? new Date().toLocaleDateString('en-CA')
              }
            />
          </Field>
          <Field label="Sprint">
            <Select
              value={sprint}
              onChange={(v) => setSprintId(v ? Number(v) : '')}
              options={[
                { value: '', label: 'No sprint' },
                ...openSprints.map((s) => ({
                  value: s.id,
                  label: `${s.name}${s.status === 'ACTIVE' ? ' (active)' : ''}`,
                })),
              ]}
            />
          </Field>
        </div>
        <Field label="Environment">
          <Input
            name="environment"
            maxLength={100}
            placeholder="e.g. Staging, Chrome 130"
            defaultValue={execution?.environment}
          />
        </Field>
        <Field label="Actual result">
          <Input.TextArea
            name="actual_result"
            rows={3}
            placeholder="What happened when you ran the test?"
            defaultValue={execution?.actual_result}
          />
        </Field>
        {!execution && status === 'FAILED' && (
          <Checkbox
            className="check-row"
            checked={logBug}
            onChange={(e) => setLogBug(e.target.checked)}
          >
            Log a bug for this failure after saving
          </Checkbox>
        )}
        <div className="actions form-footer">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!status}>
            Save test run
          </Button>
        </div>
      </form>
    </Modal>
  );
}
