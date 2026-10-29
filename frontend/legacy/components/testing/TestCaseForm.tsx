import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, Checkbox, Input, Tag, Typography } from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useData, useIssues, useSave } from '../../hooks/data';
import { api, errorMessage } from '../../services/api';
import type { Criterion, SharedStep, TestCase, TestStep } from '../../types';
import { priorities, testTypes } from '../../types';
import { Field, State } from '../ui/shared';
import { Button } from '../ui/button';
import { Select, labelled } from '../ui/form';
import { confirm, prompt } from '../ui/confirm';
type Editable = 'action' | 'test_data' | 'expected_result';
const blank = (): TestStep => ({
  step_number: 0,
  action: '',
  test_data: '',
  expected_result: '',
  shared_step_id: null,
});
export default function TestCaseForm({
  initial,
  storyId,
  onSaved,
}: {
  initial?: TestCase;
  storyId?: number;
  onSaved?: () => void;
}) {
  const issues = useIssues();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [selected, setSelected] = useState(initial?.issue_id ?? storyId ?? 0);
  const [steps, setSteps] = useState<TestStep[]>(initial?.steps ?? [blank()]);
  const [covers, setCovers] = useState<number[]>(initial?.criterion_ids ?? []);
  const save = useSave(
    initial ? `/test-cases/${initial.id}` : '/test-cases',
    initial ? 'put' : 'post',
    'Test case saved',
  );
  const story = issues.data?.find((i) => i.id === selected);
  const criteria = useData<Criterion[]>(
    `/issues/${selected}/acceptance-criteria`,
    !!selected,
  );
  const library = useData<SharedStep[]>(
    `/shared-steps?project_id=${story?.project_id}`,
    !!story,
  );
  const editStep = (index: number, field: Editable, value: string) =>
    setSteps((items) =>
      items.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  const move = (index: number, offset: number) =>
    setSteps((items) => {
      const copy = [...items];
      [copy[index], copy[index + offset]] = [copy[index + offset], copy[index]];
      return copy;
    });
  const insertShared = (id: number) => {
    const shared = library.data?.find((s) => s.id === id);
    if (shared)
      setSteps((items) => [
        ...items.filter((s) => s.action.trim() || s.shared_step_id),
        { ...blank(), ...shared, shared_step_id: shared.id },
      ]);
  };
  async function makeReusable(index: number) {
    const step = steps[index];
    if (!story || !step.action.trim()) return;
    const title = await prompt('Name this reusable step', step.action);
    if (!title) return;
    try {
      const { data } = await api.post<SharedStep>('/shared-steps', {
        project_id: story.project_id,
        title,
        action: step.action,
        test_data: step.test_data,
        expected_result: step.expected_result,
      });
      setSteps((items) =>
        items.map((s, i) =>
          i === index ? { ...s, shared_step_id: data.id } : s,
        ),
      );
      qc.invalidateQueries({
        queryKey: [`/shared-steps?project_id=${story.project_id}`],
      });
      toast.success('Added to reusable steps');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <Card className="card test-form">
      <State loading={issues.isLoading} error={issues.error} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!story) return;
          const data = Object.fromEntries(new FormData(e.currentTarget));
          try {
            const result = await save.mutateAsync({
              ...data,
              project_id: story.project_id,
              issue_id: story.id,
              criterion_ids: covers.filter((id) =>
                criteria.data?.some((c) => c.id === id),
              ),
              steps: steps.map((s, i) => ({
                step_number: i + 1,
                action: s.action,
                test_data: s.test_data,
                expected_result: s.expected_result,
                shared_step_id: s.shared_step_id,
              })),
            });
            onSaved?.();
            nav(`/test-cases/${result.id}`);
          } catch {
            /*toast*/
          }
        }}
      >
        <Field label="Linked story">
          <Select
            required
            placeholder="Select a story"
            value={selected || ''}
            disabled={!!initial}
            onChange={(v) => {
              setSelected(Number(v));
              setCovers([]);
              setSteps((items) => items.filter((s) => !s.shared_step_id));
            }}
            options={(issues.data ?? [])
              .filter((i) => i.issue_type === 'STORY')
              .map((i) => ({
                value: i.id,
                label: `${i.issue_key} — ${i.summary}`,
              }))}
          />
        </Field>
        <Field label="Title">
          <Input
            name="title"
            required
            maxLength={300}
            defaultValue={initial?.title}
          />
        </Field>
        <div className="form-grid">
          <Field label="Type">
            <Select
              name="test_type"
              defaultValue={initial?.test_type ?? 'FUNCTIONAL'}
              options={labelled(testTypes)}
            />
          </Field>
          <Field label="Priority">
            <Select
              name="priority"
              defaultValue={initial?.priority ?? 'MEDIUM'}
              options={labelled(priorities)}
            />
          </Field>
        </div>
        <fieldset className="criteria-pick">
          <legend>Acceptance criteria covered</legend>
          {!selected ? (
            <p className="muted">Select a story to see its criteria.</p>
          ) : criteria.data?.length ? (
            criteria.data.map((c) => (
              <Checkbox
                key={c.id}
                className="check-row"
                checked={covers.includes(c.id)}
                onChange={(e) =>
                  setCovers(
                    e.target.checked
                      ? [...covers, c.id]
                      : covers.filter((id) => id !== c.id),
                  )
                }
              >
                {c.description}
              </Checkbox>
            ))
          ) : (
            <p className="muted">
              {criteria.isLoading
                ? 'Loading…'
                : 'This story has no acceptance criteria yet.'}
            </p>
          )}
        </fieldset>
        <Field label="Preconditions">
          <Input.TextArea
            name="preconditions"
            autoSize={{ minRows: 2 }}
            defaultValue={initial?.preconditions}
          />
        </Field>
        <div className="section-head">
          <Typography.Title level={5}>Test steps</Typography.Title>
          <div className="actions">
            <Select
              aria-label="Insert a reusable step"
              className="inline-select"
              value={null}
              placeholder={
                library.data?.length
                  ? '+ Insert reusable step'
                  : 'No reusable steps yet'
              }
              disabled={!library.data?.length}
              onChange={(v) => insertShared(Number(v))}
              options={(library.data ?? []).map((s) => ({
                value: s.id,
                label: s.title,
              }))}
            />
            <Button
              variant="outline"
              icon={<PlusOutlined />}
              onClick={() => setSteps([...steps, blank()])}
            >
              Add step
            </Button>
          </div>
        </div>
        {steps.map((step, index) => {
          const shared = step.shared_step_id
            ? library.data?.find((s) => s.id === step.shared_step_id)
            : undefined;
          return (
            <div
              className={`step-row ${step.shared_step_id ? 'step-shared' : ''}`}
              key={index}
            >
              <span>{index + 1}</span>
              {step.shared_step_id ? (
                <div className="shared-body">
                  <p>
                    <Tag color="blue">Reusable</Tag>
                    <strong>{shared?.title ?? step.action}</strong>
                  </p>
                  <p>{step.action}</p>
                  {step.test_data && (
                    <p className="muted">Data: {step.test_data}</p>
                  )}
                  <p className="muted">
                    Expected: {step.expected_result || '—'}
                  </p>
                  <Button
                    variant="ghost"
                    size="small"
                    className="link"
                    onClick={() =>
                      setSteps(
                        steps.map((s, i) =>
                          i === index ? { ...s, shared_step_id: null } : s,
                        ),
                      )
                    }
                  >
                    Unlink to edit a copy
                  </Button>
                </div>
              ) : (
                <>
                  <Field label="Action">
                    <Input.TextArea
                      required
                      autoSize={{ minRows: 2 }}
                      aria-label={`Step ${index + 1} action`}
                      value={step.action}
                      onChange={(e) =>
                        editStep(index, 'action', e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Test data">
                    <Input.TextArea
                      autoSize={{ minRows: 2 }}
                      aria-label={`Step ${index + 1} test data`}
                      value={step.test_data}
                      onChange={(e) =>
                        editStep(index, 'test_data', e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Expected result">
                    <Input.TextArea
                      autoSize={{ minRows: 2 }}
                      aria-label={`Step ${index + 1} expected result`}
                      value={step.expected_result}
                      onChange={(e) =>
                        editStep(index, 'expected_result', e.target.value)
                      }
                    />
                  </Field>
                </>
              )}
              <div className="step-actions">
                <Button
                  variant="ghost"
                  size="small"
                  icon={<ArrowUpOutlined />}
                  aria-label={`Move step ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                />
                <Button
                  variant="ghost"
                  size="small"
                  icon={<ArrowDownOutlined />}
                  aria-label={`Move step ${index + 1} down`}
                  disabled={index === steps.length - 1}
                  onClick={() => move(index, 1)}
                />
                {!step.shared_step_id && (
                  <Button
                    variant="ghost"
                    size="small"
                    icon={<SaveOutlined />}
                    title="Save as reusable step"
                    aria-label={`Save step ${index + 1} as reusable`}
                    disabled={!story || !step.action.trim()}
                    onClick={() => makeReusable(index)}
                  />
                )}
                <Button
                  variant="ghost"
                  size="small"
                  icon={<DeleteOutlined />}
                  aria-label={`Delete step ${index + 1}`}
                  onClick={async () => {
                    if (
                      await confirm('Remove this step?', { okText: 'Remove' })
                    )
                      setSteps(steps.filter((_, i) => i !== index));
                  }}
                />
              </div>
            </div>
          );
        })}
        <Field label="Expected result">
          <Input.TextArea
            name="expected_result"
            autoSize={{ minRows: 2 }}
            defaultValue={initial?.expected_result}
          />
        </Field>
        <Field label="Test data">
          <Input.TextArea
            name="test_data"
            autoSize={{ minRows: 2 }}
            defaultValue={initial?.test_data}
          />
        </Field>
        <div className="actions form-footer">
          <Button
            variant="outline"
            onClick={() => (initial ? onSaved?.() : nav('/test-cases'))}
          >
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!story}>
            Save test case
          </Button>
        </div>
      </form>
    </Card>
  );
}
