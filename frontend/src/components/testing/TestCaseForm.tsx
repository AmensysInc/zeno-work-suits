import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useData, useIssues, useSave } from '../../hooks/data';
import { api, errorMessage } from '../../services/api';
import type { Criterion, SharedStep, TestCase, TestStep } from '../../types';
import { priorities, testTypes, label } from '../../types';
import { Field, State } from '../ui/shared';
import { Button } from '../ui/button';
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
    const title = window.prompt('Name this reusable step', step.action);
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
          <select
            required
            value={selected || ''}
            disabled={!!initial}
            onChange={(e) => {
              setSelected(Number(e.target.value));
              setCovers([]);
              setSteps((items) => items.filter((s) => !s.shared_step_id));
            }}
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
              {testTypes.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
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
        <fieldset className="criteria-pick">
          <legend>Acceptance criteria covered</legend>
          {!selected ? (
            <p className="muted">Select a story to see its criteria.</p>
          ) : criteria.data?.length ? (
            criteria.data.map((c) => (
              <label key={c.id} className="check-row">
                <input
                  type="checkbox"
                  checked={covers.includes(c.id)}
                  onChange={(e) =>
                    setCovers(
                      e.target.checked
                        ? [...covers, c.id]
                        : covers.filter((id) => id !== c.id),
                    )
                  }
                />
                {c.description}
              </label>
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
          <textarea
            name="preconditions"
            defaultValue={initial?.preconditions}
          />
        </Field>
        <div className="section-head">
          <h3>Test steps</h3>
          <div className="actions">
            <select
              aria-label="Insert a reusable step"
              value=""
              disabled={!library.data?.length}
              onChange={(e) => insertShared(Number(e.target.value))}
            >
              <option value="">
                {library.data?.length
                  ? '+ Insert reusable step'
                  : 'No reusable steps yet'}
              </option>
              {library.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              onClick={() => setSteps([...steps, blank()])}
            >
              + Add step
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
                    <span className="chip">Reusable</span>
                    <strong>{shared?.title ?? step.action}</strong>
                  </p>
                  <p>{step.action}</p>
                  {step.test_data && (
                    <p className="muted">Data: {step.test_data}</p>
                  )}
                  <p className="muted">
                    Expected: {step.expected_result || '—'}
                  </p>
                  <button
                    type="button"
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
                  </button>
                </div>
              ) : (
                <>
                  <Field label="Action">
                    <textarea
                      required
                      aria-label={`Step ${index + 1} action`}
                      value={step.action}
                      onChange={(e) =>
                        editStep(index, 'action', e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Test data">
                    <textarea
                      aria-label={`Step ${index + 1} test data`}
                      value={step.test_data}
                      onChange={(e) =>
                        editStep(index, 'test_data', e.target.value)
                      }
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
                </>
              )}
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
                {!step.shared_step_id && (
                  <button
                    type="button"
                    title="Save as reusable step"
                    aria-label={`Save step ${index + 1} as reusable`}
                    disabled={!story || !step.action.trim()}
                    onClick={() => makeReusable(index)}
                  >
                    ♻
                  </button>
                )}
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
          );
        })}
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
            onClick={() => (initial ? onSaved?.() : nav('/test-cases'))}
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
