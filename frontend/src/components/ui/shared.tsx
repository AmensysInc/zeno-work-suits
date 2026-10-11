import type { ReactNode } from 'react';
import { label } from '../../types';
export function Badge({ value }: { value: string }) {
  return (
    <span className={`badge badge-${value.toLowerCase()}`}>{label(value)}</span>
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
        <h1>{title}</h1>
        {description && <p>{description}</p>}
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
        Loading…
      </div>
    );
  if (error)
    return (
      <div className="empty error" role="alert">
        Unable to load this page. Please refresh and try again.
      </div>
    );
  if (empty)
    return (
      <div className="empty">
        Nothing here yet. Create your first item to get started.
      </div>
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
