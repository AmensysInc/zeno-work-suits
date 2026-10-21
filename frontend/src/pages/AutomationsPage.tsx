import { useState } from 'react';
import { useData, useProjects, useSave } from '../hooks/data';
import { Button } from '../components/ui/button';
import { Modal } from '../components/ui/dialog';
import { Badge, Field, State } from '../components/ui/shared';
import {
  automationActions,
  statuses,
  label,
  type AutomationAction,
  type AutomationRule,
} from '../types';

const actionText: Record<AutomationAction, string> = {
  NOTIFY_REPORTER: 'Notify reporter',
  NOTIFY_ASSIGNEE: 'Notify assignee',
  CREATE_BUG: 'Create bug',
};

function RuleCard({ rule }: { rule: AutomationRule }) {
  const del = useSave(`/automations/${rule.id}`, 'delete', 'Rule deleted');
  return (
    <article className="automation-rule">
      <div>
        <h2>{rule.name}</h2>
        <p className="muted">
          {rule.project?.name ?? 'All projects'} / Status changes to{' '}
          {label(rule.to_status)} / {actionText[rule.action]}
        </p>
      </div>
      <div className="actions">
        <Badge value={rule.enabled ? 'ACTIVE' : 'INACTIVE'} />
        <Button
          variant="ghost"
          disabled={del.isPending}
          onClick={() => del.mutate({})}
        >
          Delete
        </Button>
      </div>
    </article>
  );
}

export default function AutomationsPage() {
  const [open, setOpen] = useState(false);
  const rules = useData<AutomationRule[]>('/automations');
  const projects = useProjects();
  const create = useSave('/automations', 'post', 'Automation rule created');
  return (
    <>
      <div className="automation-heading">
        <div>
          <h1>
            <span className="automation-icon" aria-hidden="true">
              A
            </span>
            Automations
          </h1>
          <p>Run actions automatically when tickets change.</p>
        </div>
        <Button onClick={() => setOpen(true)}>+ New Rule</Button>
      </div>

      <section className="automation-card">
        <State
          loading={rules.isLoading}
          error={rules.error}
          empty={rules.data?.length === 0}
        />
        {rules.data?.map((rule) => (
          <RuleCard key={rule.id} rule={rule} />
        ))}
      </section>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create automation rule"
      >
        <form
          className="automation-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.currentTarget));
            try {
              await create.mutateAsync({
                name: data.name,
                project_id: data.project_id ? Number(data.project_id) : null,
                trigger: 'STATUS_CHANGED',
                to_status: data.to_status,
                action: data.action,
              });
              setOpen(false);
            } catch {
              /* toast */
            }
          }}
        >
          <Field label="Name">
            <input
              name="name"
              required
              maxLength={200}
              autoFocus
              placeholder="e.g. Notify on Done"
            />
          </Field>
          <Field label="Project (optional)">
            <select name="project_id" defaultValue="">
              <option value="">All projects</option>
              {projects.data?.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="automation-grid">
            <Field label="When">
              <select name="trigger" defaultValue="STATUS_CHANGED" disabled>
                <option value="STATUS_CHANGED">Status changes</option>
              </select>
            </Field>
            <Field label="To status">
              <select name="to_status" defaultValue="IN_PROGRESS">
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {label(status)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Then">
            <select name="action" defaultValue="NOTIFY_REPORTER">
              {automationActions.map((action) => (
                <option key={action} value={action}>
                  {actionText[action]}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-footer actions">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
