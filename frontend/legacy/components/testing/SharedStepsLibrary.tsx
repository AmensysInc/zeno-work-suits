import { useState } from 'react';
import { Alert, Card, Input, Table } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useData, useSave } from '../../hooks/data';
import type { SharedStep } from '../../types';
import { Field, State } from '../ui/shared';
import { Button } from '../ui/button';
import { Modal } from '../ui/dialog';
import { confirm } from '../ui/confirm';

function StepEditor({
  projectId,
  step,
  onClose,
}: {
  projectId: number;
  step?: SharedStep;
  onClose: () => void;
}) {
  const save = useSave(
    step ? `/shared-steps/${step.id}` : '/shared-steps',
    step ? 'put' : 'post',
    'Reusable step saved',
  );
  return (
    <Modal
      open
      onClose={onClose}
      title={step ? 'Edit reusable step' : 'New reusable step'}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await save.mutateAsync({
              project_id: projectId,
              ...Object.fromEntries(new FormData(e.currentTarget)),
            });
            onClose();
          } catch {
            /* toast */
          }
        }}
      >
        {!!step?.usage_count && (
          <Alert
            className="linked-context"
            type="info"
            title={`Used in ${step.usage_count} test case${step.usage_count === 1 ? '' : 's'}. Saving updates all of them.`}
          />
        )}
        <Field label="Name">
          <Input
            name="title"
            required
            maxLength={200}
            defaultValue={step?.title}
          />
        </Field>
        <Field label="Action">
          <Input.TextArea
            name="action"
            required
            autoSize={{ minRows: 2 }}
            defaultValue={step?.action}
          />
        </Field>
        <Field label="Test data">
          <Input.TextArea
            name="test_data"
            autoSize={{ minRows: 2 }}
            defaultValue={step?.test_data}
          />
        </Field>
        <Field label="Expected result">
          <Input.TextArea
            name="expected_result"
            autoSize={{ minRows: 2 }}
            defaultValue={step?.expected_result}
          />
        </Field>
        <div className="actions form-footer">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            Save step
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteStep({ step }: { step: SharedStep }) {
  const del = useSave(
    `/shared-steps/${step.id}`,
    'delete',
    'Reusable step deleted',
  );
  return (
    <Button
      variant="ghost"
      size="small"
      icon={<DeleteOutlined />}
      aria-label={`Delete ${step.title}`}
      disabled={del.isPending}
      onClick={async () => {
        if (
          await confirm(
            step.usage_count
              ? `Delete "${step.title}"? The ${step.usage_count} test case(s) using it keep their own copy.`
              : `Delete "${step.title}"?`,
            { okText: 'Delete' },
          )
        )
          del.mutate({});
      }}
    />
  );
}

export default function SharedStepsLibrary({
  projectId,
}: {
  projectId: number;
}) {
  const query = useData<SharedStep[]>(`/shared-steps?project_id=${projectId}`);
  const [editing, setEditing] = useState<SharedStep | 'new' | null>(null);
  const items = query.data ?? [];
  return (
    <Card
      className="card"
      title="Reusable steps"
      extra={
        <Button icon={<PlusOutlined />} onClick={() => setEditing('new')}>
          New reusable step
        </Button>
      }
    >
      <p className="muted section-intro">
        Write common steps once, such as signing in, and insert them into any
        test case. Edits apply everywhere they are used.
      </p>
      <State
        loading={query.isLoading}
        error={query.error}
        empty={!query.isLoading && !items.length}
      />
      {!!items.length && (
        <Table
          rowKey="id"
          size="middle"
          pagination={false}
          scroll={{ x: 'max-content' }}
          dataSource={items}
          columns={[
            {
              title: 'Name',
              dataIndex: 'title',
              render: (title, s) => (
                <Button
                  variant="ghost"
                  size="small"
                  className="link"
                  onClick={() => setEditing(s)}
                >
                  {title}
                </Button>
              ),
            },
            { title: 'Action', dataIndex: 'action', className: 'wrap' },
            {
              title: 'Test data',
              dataIndex: 'test_data',
              className: 'wrap muted',
              render: (v) => v || '—',
            },
            {
              title: 'Expected result',
              dataIndex: 'expected_result',
              className: 'wrap',
              render: (v) => v || '—',
            },
            {
              title: 'Used in',
              dataIndex: 'usage_count',
              render: (n) => `${n} test${n === 1 ? '' : 's'}`,
            },
            { key: 'delete', render: (_, s) => <DeleteStep step={s} /> },
          ]}
        />
      )}
      {editing && (
        <StepEditor
          projectId={projectId}
          step={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}
