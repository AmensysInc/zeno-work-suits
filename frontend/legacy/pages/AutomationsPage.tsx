import { useState } from 'react';
import { Card, Input, Typography } from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useData, useProjects, useSave } from '../hooks/data';
import { Button } from '../components/ui/button';
import { Modal } from '../components/ui/dialog';
import { Badge, Field, PageHeader, State } from '../components/ui/shared';
import { Select, labelled } from '../components/ui/form';
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
        <Typography.Title level={5}>
          <ThunderboltOutlined className="automation-icon" /> {rule.name}
        </Typography.Title>
        <p className="muted">
          {rule.project?.name ?? 'All projects'} / Status changes to{' '}
          {label(rule.to_status)} / {actionText[rule.action]}
        </p>
      </div>
      <div className="actions">
        <Badge value={rule.enabled ? 'ACTIVE' : 'INACTIVE'} />
        <Button
          variant="ghost"
          icon={<DeleteOutlined />}
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
      <PageHeader
        title="Automations"
        description="Run actions automatically when tickets change."
      >
        <Button icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          New rule
        </Button>
      </PageHeader>

      <Card className="card automation-card">
        <State
          loading={rules.isLoading}
          error={rules.error}
          empty={rules.data?.length === 0}
        />
        {rules.data?.map((rule) => (
          <RuleCard key={rule.id} rule={rule} />
        ))}
      </Card>

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
            <Input
              name="name"
              required
              maxLength={200}
              autoFocus
              placeholder="e.g. Notify on Done"
            />
          </Field>
          <Field label="Project (optional)">
            <Select
              name="project_id"
              defaultValue=""
              options={[
                { value: '', label: 'All projects' },
                ...(projects.data ?? []).map((project) => ({
                  value: project.id,
                  label: project.name,
                })),
              ]}
            />
          </Field>
          <div className="automation-grid">
            <Field label="When">
              <Select
                defaultValue="STATUS_CHANGED"
                disabled
                options={[{ value: 'STATUS_CHANGED', label: 'Status changes' }]}
              />
            </Field>
            <Field label="To status">
              <Select
                name="to_status"
                defaultValue="IN_PROGRESS"
                options={labelled(statuses)}
              />
            </Field>
          </div>
          <Field label="Then">
            <Select
              name="action"
              defaultValue="NOTIFY_REPORTER"
              options={automationActions.map((action) => ({
                value: action,
                label: actionText[action],
              }))}
            />
          </Field>
          <div className="form-footer actions">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
