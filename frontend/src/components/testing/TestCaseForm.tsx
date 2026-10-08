import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIssues, useSave } from '../../hooks/data';
import type { TestCase, TestStep } from '../../types';
import { priorities, label } from '../../types';
import { Field, State } from '../ui/shared';
import { Button } from '../ui/button';
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
  const [selected, setSelected] = useState(initial?.issue_id ?? storyId ?? 0);
  const [steps, setSteps] = useState<TestStep[]>(
    initial?.steps ?? [{ step_number: 1, action: '', expected_result: '' }],
  );
  const save = useSave(
    initial ? `/test-cases/${initial.id}` : '/test-cases',
    initial ? 'put' : 'post',
    'Test case saved',
  );
  const story = issues.data?.find((i) => i.id === selected);
  const editStep = (
    index: number,
    field: 'action' | 'expected_result',
    value: string,
  ) =>
    setSteps((items) =>
      items.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  const move = (index: number, offset: number) =>
    setSteps((items) => {
      const copy = [...items];
      [copy[index], copy[index + offset]] = [copy[index + offset], copy[index]];
      return copy;
    });
  return (
    <section className="card test-form">
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
              status: initial?.status ?? 'NOT_RUN',
              steps: steps.map((s, i) => ({
                step_number: i + 1,
                action: s.action,
                expected_result: s.expected_result,
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
          <select
            required
            value={selected || ''}
            disabled={!!initial}
            onChange={(e) => setSelected(Number(e.target.value))}
          >
            <option value="">Select a story</option>
            {issues.data
              ?.filter((i) => i.issue_type === 'STORY')
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.issue_key} — {i.summary}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Title">
          <input
            name="title"
            required
            maxLength={300}
            defaultValue={initial?.title}
          />
        </Field>
        <div className="form-grid">
          <Field label="Type">
            <select
              name="test_type"
              defaultValue={initial?.test_type ?? 'FUNCTIONAL'}
            >
              {['FUNCTIONAL', 'REGRESSION', 'INTEGRATION', 'UI', 'API'].map(
                (t) => (
                  <option key={t}>{t}</option>
                ),
              )}
            </select>
          </Field>
          <Field label="Priority">
            <select
              name="priority"
              defaultValue={initial?.priority ?? 'MEDIUM'}
            >
              {priorities.map((t) => (
                <option value={t} key={t}>
                  {label(t)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Preconditions">
          <textarea
            name="preconditions"
            defaultValue={initial?.preconditions}
          />
        </Field>
        <div className="section-head">
          <h3>Test steps</h3>
          <Button
            variant="outline"
            onClick={() =>
              setSteps([
                ...steps,
                {
                  step_number: steps.length + 1,
                  action: '',
                  expected_result: '',
                },
              ])
            }
          >
            + Add step
          </Button>
        </div>
        {steps.map((step, index) => (
          <div className="step-row" key={index}>
            <span>{index + 1}</span>
            <Field label="Action">
              <textarea
                required
                aria-label={`Step ${index + 1} action`}
                value={step.action}
                onChange={(e) => editStep(index, 'action', e.target.value)}
              />
            </Field>
            <Field label="Expected result">
              <textarea
                aria-label={`Step ${index + 1} expected result`}
                value={step.expected_result}
                onChange={(e) =>
                  editStep(index, 'expected_result', e.target.value)
                }
              />
            </Field>
            <div className="step-actions">
              <button
                type="button"
                aria-label={`Move step ${index + 1} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move step ${index + 1} down`}
                disabled={index === steps.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`Delete step ${index + 1}`}
                onClick={() => {
                  if (window.confirm('Remove this step?'))
                    setSteps(steps.filter((_, i) => i !== index));
                }}
              >
                ×
              </button>
            </div>
          </div>
        ))}
        <Field label="Expected result">
          <textarea
            name="expected_result"
            defaultValue={initial?.expected_result}
          />
        </Field>
        <Field label="Test data">
          <textarea name="test_data" defaultValue={initial?.test_data} />
        </Field>
        <div className="actions form-footer">
          <Button
            variant="outline"
            onClick={() =>
              nav(initial ? `/test-cases/${initial.id}` : '/test-cases')
            }
          >
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending || !story}>
            Save test case
          </Button>
        </div>
      </form>
    </section>
  );
}
