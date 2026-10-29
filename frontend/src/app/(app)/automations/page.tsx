'use client';

import { useRef, useState } from 'react';
import { ArrowRight, Plus, Trash2, Zap } from 'lucide-react';
import { useData, useProjects, useSave } from '@/hooks/data';
import { automationActions, statuses, type AutomationAction, type AutomationRule, type Issue } from '@/types';
import { PageBar, PageBody } from '@/components/layout/page';
import { Badge, Card, Empty, ProjectMark, State } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusIcon, statusMeta } from '@/components/ui/glyphs';

const actionText: Record<AutomationAction, string> = {
  NOTIFY_REPORTER: 'Notify reporter',
  NOTIFY_ASSIGNEE: 'Notify assignee',
  CREATE_BUG: 'Create bug',
};

function RuleRow({ rule }: { rule: AutomationRule }) {
  const del = useSave(`/automations/${rule.id}`, 'delete', 'Rule deleted');
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
        <Zap className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[13.5px] font-semibold">{rule.name}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
          {rule.project ? (
            <span className="inline-flex items-center gap-1.5">
              <ProjectMark project={rule.project} size={14} />
              {rule.project.name}
            </span>
          ) : (
            'All projects'
          )}
          <span className="text-ink-4">·</span>
          When status changes to
          <span className="inline-flex items-center gap-1 font-medium text-ink">
            <StatusIcon status={rule.to_status} size={12} />
            {statusMeta[rule.to_status].label}
          </span>
          <ArrowRight className="size-3 text-ink-3" />
          <span className="font-medium text-ink">{actionText[rule.action]}</span>
        </span>
      </div>
      <Badge value={rule.enabled ? 'ACTIVE' : 'INACTIVE'} dot />
      <Button variant="ghost" icon={<Trash2 />} disabled={del.isPending} onClick={() => del.mutate({})}>
        Delete
      </Button>
    </div>
  );
}

function CreateRule({ onClose }: { onClose: () => void }) {
  const projects = useProjects();
  const create = useSave('/automations', 'post', 'Automation rule created');
  const form = useRef<HTMLFormElement>(null);
  const [project, setProject] = useState(0);
  const [toStatus, setToStatus] = useState<Issue['status']>('IN_PROGRESS');
  const [action, setAction] = useState<AutomationAction>('NOTIFY_REPORTER');
  const submit = async () => {
    if (!form.current?.reportValidity()) return;
    try {
      await create.mutateAsync({ name: new FormData(form.current).get('name'), project_id: project || null, trigger: 'STATUS_CHANGED', to_status: toStatus, action });
      onClose();
    } catch {
      /* toast */
    }
  };
  return (
    <Dialog
      title="Create automation rule"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={create.isPending} onClick={submit}>
            Create
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
        <Field label="Name">{(id) => <Input id={id} name="name" required maxLength={200} autoFocus placeholder="e.g. Notify on Done" />}</Field>
        <Field label="Project" optional>
          {(id) => <Select<number> id={id} value={project} onChange={setProject} options={[{ value: 0, label: 'All projects' }, ...(projects.data ?? []).map((p) => ({ value: p.id, label: p.name }))]} />}
        </Field>
        <div className="rounded-lg border border-line bg-subtle p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="When">{(id) => <Select id={id} value="STATUS_CHANGED" disabled onChange={() => {}} options={[{ value: 'STATUS_CHANGED', label: 'Status changes' }]} />}</Field>
            <Field label="To status">
              {(id) => <Select<Issue['status']> id={id} value={toStatus} onChange={setToStatus} options={statuses.map((s) => ({ value: s, label: statusMeta[s].label, icon: <StatusIcon status={s} size={12} /> }))} />}
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Then">{(id) => <Select<AutomationAction> id={id} value={action} onChange={setAction} options={automationActions.map((a) => ({ value: a, label: actionText[a] }))} />}</Field>
          </div>
        </div>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

export default function AutomationsPage() {
  const [open, setOpen] = useState(false);
  const rules = useData<AutomationRule[]>('/automations');
  return (
    <>
      <PageBar
        crumbs={['Automations']}
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setOpen(true)}>
            New rule
          </Button>
        }
      />
      <PageBody>
        <div className="mx-auto flex max-w-[960px] flex-col gap-4">
          <p className="text-[13px] text-ink-2">Run actions automatically when tickets change.</p>
          <Card className="overflow-hidden">
            <State loading={rules.isLoading} error={rules.error} />
            {rules.data?.length === 0 && (
              <Empty icon={<Zap />} title="No rules yet">
                Create a rule to notify people or log bugs when a ticket changes status.
              </Empty>
            )}
            {rules.data?.map((rule) => (
              <RuleRow key={rule.id} rule={rule} />
            ))}
          </Card>
        </div>
      </PageBody>
      {open && <CreateRule onClose={() => setOpen(false)} />}
    </>
  );
}
