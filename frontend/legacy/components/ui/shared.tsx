import type { ReactNode } from 'react';
import { Alert, Empty, Spin, Tag, Typography } from 'antd';
import { label } from '../../types';

const tagColors: Record<string, string> = {
  STORY: 'blue',
  TODO: 'blue',
  IN_PROGRESS: 'processing',
  EPIC: 'purple',
  TASK: 'geekblue',
  SUBTASK: 'cyan',
  CODE_REVIEW: 'purple',
  BUG: 'red',
  FAILED: 'error',
  CRITICAL: 'red',
  AT_RISK: 'error',
  CLOSED: 'red',
  DONE: 'success',
  PASSED: 'success',
  ACTIVE: 'success',
  READY: 'success',
  OPEN: 'success',
  TESTING: 'warning',
  HIGH: 'orange',
  BLOCKED: 'warning',
  MANAGER: 'gold',
  GAP: 'warning',
  ADMIN: 'purple',
  MERGED: 'purple',
  MEDIUM: 'blue',
  LOW: 'default',
};

/** A colored tag for an enum value; `children` overrides its label. */
export function Badge({
  value,
  children,
}: {
  value: string;
  children?: ReactNode;
}) {
  return (
    <Tag color={tagColors[value.toUpperCase()]} variant="filled">
      {children ?? label(value)}
    </Tag>
  );
}
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <Typography.Title level={3}>{title}</Typography.Title>
        {description && (
          <Typography.Text type="secondary">{description}</Typography.Text>
        )}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function State({
  loading,
  error,
  empty,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
}) {
  if (loading)
    return (
      <div className="empty" role="status">
        <Spin />
      </div>
    );
  if (error)
    return (
      <Alert
        type="error"
        showIcon
        role="alert"
        title="Unable to load this page. Please refresh and try again."
      />
    );
  if (empty)
    return (
      <Empty
        className="empty"
        description="Nothing here yet. Create your first item to get started."
      />
    );
  return null;
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
