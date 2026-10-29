'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, BookmarkPlus, Plus, Trash2 } from 'lucide-react';
import { useData, useIssues, useSave } from '@/hooks/data';
import { api, errorMessage } from '@/lib/api';
import { label, priorities, testTypes, type Criterion, type SharedStep, type TestCase, type TestStep } from '@/types';
import { Badge, Card, CardHeader, State } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/controls';
import { confirm, prompt } from '@/components/ui/confirm';
import { cn } from '@/lib/utils';

type Editable = 'action' | 'test_data' | 'expected_result';
const blank = (): TestStep => ({ step_number: 0, action: '', test_data: '', expected_result: '', shared_step_id: null });

export default function TestCaseForm({ initial, storyId, onSaved }: { initial?: TestCase; storyId?: number; onSaved?: () => void }) {
  const issues = useIssues();
  const router = useRouter();
  const qc = useQueryClient();
  const [selected, setSelected] = useState(initial?.issue_id ?? storyId ?? 0);
  const [steps, setSteps] = useState<TestStep[]>(initial?.steps ?? [blank()]);
  const [covers, setCovers] = useState<number[]>(initial?.criterion_ids ?? []);
  const [testType, setTestType] = useState<string>(initial?.test_type ?? 'FUNCTIONAL');
  const [priority, setPriority] = useState<string>(initial?.priority ?? 'MEDIUM');
  const save = useSave<unknown>(initial ? `/test-cases/${initial.id}` : '/test-cases', initial ? 'put' : 'post', 'Test case saved');
  const story = issues.data?.find((i) => i.id === selected);
  const criteria = useData<Criterion[]>(`/issues/${selected}/acceptance-criteria`, !!selected);
  const library = useData<SharedStep[]>(`/shared-steps?project_id=${story?.project_id}`, !!story);
  const editStep = (index: number, field: Editable, value: string) => setSteps((items) => items.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  const move = (index: number, offset: number) =>
    setSteps((items) => {
      const copy = [...items];
      [copy[index], copy[index + offset]] = [copy[index + offset], copy[index]];
      return copy;
    });
  const insertShared = (id: number) => {
    const shared = library.data?.find((s) => s.id === id);
    if (shared) setSteps((items) => [...items.filter((s) => s.action.trim() || s.shared_step_id), { ...blank(), ...shared, shared_step_id: shared.id }]);
  };
  async function makeReusable(index: number) {
    const step = steps[index];
    if (!story || !step.action.trim()) return;
    const title = await prompt('Name this reusable step', step.action);
    if (!title) return;
    try {
      const { data } = await api.post<SharedStep>('/shared-steps', { project_id: story.project_id, title, action: step.action, test_data: step.test_data, expected_result: step.expected_result });
      setSteps((items) => items.map((s, i) => (i === index ? { ...s, shared_step_id: data.id } : s)));
      qc.invalidateQueries({ queryKey: [`/shared-steps?project_id=${story.project_id}`] });
      toast.success('Added to reusable steps');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!story) return;
        const data = Object.fromEntries(new FormData(e.currentTarget));
        try {
          const result = (await save.mutateAsync({
            ...data,
            test_type: testType,
            priority,
            project_id: story.project_id,
            issue_id: story.id,
            criterion_ids: covers.filter((id) => criteria.data?.some((c) => c.id === id)),
            steps: steps.map((s, i) => ({ step_number: i + 1, action: s.action, test_data: s.test_data, expected_result: s.expected_result, shared_step_id: s.shared_step_id })),
          })) as TestCase;
          onSaved?.();
          router.push(`/test-cases/${result.id}`);
        } catch {
          /* toast */
        }
      }}
    >
      <State loading={issues.isLoading} error={issues.error} />
      <Card className="flex flex-col gap-3.5 p-4">
        <Field label="Linked story">
          {(id) => (
            <Select<number>
              id={id}
              placeholder="Select a story"
              value={selected || undefined}
              disabled={!!initial}
              onChange={(v) => {
                setSelected(v);
                setCovers([]);
                setSteps((items) => items.filter((s) => !s.shared_step_id));
              }}
              options={(issues.data ?? []).filter((i) => i.issue_type === 'STORY').map((i) => ({ value: i.id, label: `${i.issue_key} — ${i.summary}` }))}
            />
          )}
        </Field>
        <Field label="Title">{(id) => <Input id={id} size="lg" name="title" required maxLength={300} defaultValue={initial?.title} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">{(id) => <Select id={id} value={testType} onChange={setTestType} options={testTypes.map((t) => ({ value: t, label: label(t) }))} />}</Field>
          <Field label="Priority">{(id) => <Select id={id} value={priority} onChange={setPriority} options={priorities.map((p) => ({ value: p, label: label(p) }))} />}</Field>
        </div>
        <fieldset className="flex flex-col gap-1.5 rounded-lg border border-line px-3 py-2.5">
          <legend className="px-1 text-[12.5px] font-medium">Acceptance criteria covered</legend>
          {!selected ? (
            <p className="text-[12.5px] text-ink-3">Select a story to see its criteria.</p>
          ) : criteria.data?.length ? (
            criteria.data.map((c) => <Checkbox key={c.id} checked={covers.includes(c.id)} onChange={(on) => setCovers(on ? [...covers, c.id] : covers.filter((id) => id !== c.id))} label={c.description} />)
          ) : (
            <p className="text-[12.5px] text-ink-3">{criteria.isLoading ? 'Loading…' : 'This story has no acceptance criteria yet.'}</p>
          )}
        </fieldset>
        <Field label="Preconditions" optional>
          {(id) => <Textarea id={id} name="preconditions" rows={2} defaultValue={initial?.preconditions} />}
        </Field>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Test steps"
          subtitle={`${steps.length} step${steps.length === 1 ? '' : 's'}`}
          className="pb-3"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Select<number>
                size="sm"
                aria-label="Insert a reusable step"
                className="w-48"
                value={null}
                placeholder={library.data?.length ? '+ Insert reusable step' : 'No reusable steps yet'}
                disabled={!library.data?.length}
                onChange={insertShared}
                options={(library.data ?? []).map((s) => ({ value: s.id, label: s.title }))}
              />
              <Button size="sm" icon={<Plus />} onClick={() => setSteps([...steps, blank()])}>
                Add step
              </Button>
            </div>
          }
        />
        <div className="border-t border-line">
          {steps.map((step, index) => {
            const shared = step.shared_step_id ? library.data?.find((s) => s.id === step.shared_step_id) : undefined;
            return (
              <div key={index} className={cn('flex gap-3 border-b border-line px-4 py-3 last:border-b-0', step.shared_step_id && 'bg-accent-soft/40')}>
                <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-hover text-xs font-semibold text-ink-2">{index + 1}</span>
                {step.shared_step_id ? (
                  <div className="flex min-w-0 flex-1 flex-col gap-1 text-[13px]">
                    <p className="flex items-center gap-2">
                      <Badge tone="indigo">Reusable</Badge>
                      <strong className="font-semibold">{shared?.title ?? step.action}</strong>
                    </p>
                    <p>{step.action}</p>
                    {step.test_data && <p className="text-xs text-ink-3">Data: {step.test_data}</p>}
                    <p className="text-xs text-ink-3">Expected: {step.expected_result || '—'}</p>
                    <button type="button" className="self-start text-xs font-medium text-accent-ink hover:underline" onClick={() => setSteps(steps.map((s, i) => (i === index ? { ...s, shared_step_id: null } : s)))}>
                      Unlink to edit a copy
                    </button>
                  </div>
                ) : (
                  <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-3">
                    <Textarea required rows={2} aria-label={`Step ${index + 1} action`} placeholder="Action" value={step.action} onChange={(e) => editStep(index, 'action', e.target.value)} />
                    <Textarea rows={2} aria-label={`Step ${index + 1} test data`} placeholder="Test data" value={step.test_data} onChange={(e) => editStep(index, 'test_data', e.target.value)} />
                    <Textarea rows={2} aria-label={`Step ${index + 1} expected result`} placeholder="Expected result" value={step.expected_result} onChange={(e) => editStep(index, 'expected_result', e.target.value)} />
                  </div>
                )}
                <div className="flex shrink-0 flex-col gap-0.5 sm:flex-row sm:items-start">
                  <Button size="icon" variant="ghost" icon={<ArrowUp />} aria-label={`Move step ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)} />
                  <Button size="icon" variant="ghost" icon={<ArrowDown />} aria-label={`Move step ${index + 1} down`} disabled={index === steps.length - 1} onClick={() => move(index, 1)} />
                  {!step.shared_step_id && (
                    <Button size="icon" variant="ghost" icon={<BookmarkPlus />} title="Save as reusable step" aria-label={`Save step ${index + 1} as reusable`} disabled={!story || !step.action.trim()} onClick={() => makeReusable(index)} />
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    icon={<Trash2 />}
                    aria-label={`Delete step ${index + 1}`}
                    onClick={async () => {
                      if (await confirm('Remove this step?', { okText: 'Remove' })) setSteps(steps.filter((_, i) => i !== index));
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="grid gap-3.5 p-4 md:grid-cols-2">
        <Field label="Expected result">{(id) => <Textarea id={id} name="expected_result" rows={2} defaultValue={initial?.expected_result} />}</Field>
        <Field label="Test data" optional>
          {(id) => <Textarea id={id} name="test_data" rows={2} defaultValue={initial?.test_data} />}
        </Field>
      </Card>
      <div className="flex justify-end gap-2">
        <Button onClick={() => (initial ? onSaved?.() : router.push('/test-cases'))}>Cancel</Button>
        <Button type="submit" variant="primary" loading={save.isPending} disabled={!story}>
          Save test case
        </Button>
      </div>
    </form>
  );
}
