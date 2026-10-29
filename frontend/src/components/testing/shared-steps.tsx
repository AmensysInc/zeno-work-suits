'use client';

import { useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useData, useSave } from '@/hooks/data';
import type { SharedStep } from '@/types';
import { Note, State } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { confirm } from '@/components/ui/confirm';

function StepEditor({ projectId, step, onClose }: { projectId: number; step?: SharedStep; onClose: () => void }) {
  const form = useRef<HTMLFormElement>(null);
  const save = useSave(step ? `/shared-steps/${step.id}` : '/shared-steps', step ? 'put' : 'post', 'Reusable step saved');
  const submit = async () => {
    if (!form.current?.reportValidity()) return;
    try {
      await save.mutateAsync({ project_id: projectId, ...Object.fromEntries(new FormData(form.current)) });
      onClose();
    } catch {
      /* toast */
    }
  };
  return (
    <Dialog
      onClose={onClose}
      title={step ? 'Edit reusable step' : 'New reusable step'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            Save step
          </Button>
        </>
      }
    >
      <form
        ref={form}
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {!!step?.usage_count && (
          <Note tone="blue">
            Used in {step.usage_count} test case{step.usage_count === 1 ? '' : 's'}. Saving updates all of them.
          </Note>
        )}
        <Field label="Name">{(id) => <Input id={id} name="title" required maxLength={200} defaultValue={step?.title} autoFocus />}</Field>
        <Field label="Action">{(id) => <Textarea id={id} name="action" required rows={2} defaultValue={step?.action} />}</Field>
        <Field label="Test data" optional>
          {(id) => <Textarea id={id} name="test_data" rows={2} defaultValue={step?.test_data} />}
        </Field>
        <Field label="Expected result">{(id) => <Textarea id={id} name="expected_result" rows={2} defaultValue={step?.expected_result} />}</Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

function DeleteStep({ step }: { step: SharedStep }) {
  const del = useSave(`/shared-steps/${step.id}`, 'delete', 'Reusable step deleted');
  return (
    <Button
      variant="ghost"
      size="icon"
      icon={<Trash2 />}
      aria-label={`Delete ${step.title}`}
      disabled={del.isPending}
      onClick={async () => {
        if (await confirm(step.usage_count ? `Delete "${step.title}"? The ${step.usage_count} test case(s) using it keep their own copy.` : `Delete "${step.title}"?`, { okText: 'Delete' })) del.mutate({});
      }}
    />
  );
}

export default function SharedStepsLibrary({ projectId }: { projectId: number }) {
  const query = useData<SharedStep[]>(`/shared-steps?project_id=${projectId}`);
  const [editing, setEditing] = useState<SharedStep | 'new' | null>(null);
  const items = query.data ?? [];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-3 sm:px-[18px]">
        <p className="min-w-0 flex-1 text-[12.5px] text-ink-2">Write common steps once, such as signing in, and insert them into any test case. Edits apply everywhere they are used.</p>
        <Button variant="primary" icon={<Plus />} onClick={() => setEditing('new')}>
          New reusable step
        </Button>
      </div>
      <State loading={query.isLoading} error={query.error} empty={!query.isLoading && !items.length} emptyText="No reusable steps yet." />
      {!!items.length && (
        <Table>
          <thead>
            <tr>
              <Th className="w-52">Name</Th>
              <Th>Action</Th>
              <Th>Test data</Th>
              <Th>Expected result</Th>
              <Th className="w-24">Used in</Th>
              <Th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <Tr key={s.id} onClick={() => setEditing(s)}>
                <Td className="font-medium text-accent-ink">{s.title}</Td>
                <Td className="whitespace-pre-wrap">{s.action}</Td>
                <Td className="whitespace-pre-wrap text-ink-3">{s.test_data || '—'}</Td>
                <Td className="whitespace-pre-wrap">{s.expected_result || '—'}</Td>
                <Td className="whitespace-nowrap text-ink-2">
                  {s.usage_count} test{s.usage_count === 1 ? '' : 's'}
                </Td>
                <Td onClick={(e) => e.stopPropagation()}>
                  <DeleteStep step={s} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      {editing && <StepEditor projectId={projectId} step={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
