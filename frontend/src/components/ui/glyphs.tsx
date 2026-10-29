import { Bookmark, Bug, SquareCheck, CornerDownRight, Zap } from 'lucide-react';
import { label, type Issue } from '@/types';
import { Badge } from './display';

/* Status: progress circles, one per workflow step. */
export const statusMeta: Record<Issue['status'], { label: string; color: string; fill: number; dashed?: boolean }> = {
  BACKLOG: { label: 'Backlog', color: '#9ca0aa', fill: 0, dashed: true },
  TODO: { label: 'To do', color: '#8a8e99', fill: 0 },
  IN_PROGRESS: { label: 'In progress', color: '#e8a317', fill: 0.5 },
  CODE_REVIEW: { label: 'Code review', color: '#8b5cf6', fill: 0.75 },
  TESTING: { label: 'Testing', color: '#0ea5e9', fill: 0.85 },
  DONE: { label: 'Done', color: '#16a34a', fill: 1 },
};

export function StatusIcon({ status, size = 14 }: { status: Issue['status']; size?: number }) {
  const m = statusMeta[status] ?? statusMeta.TODO;
  if (m.fill >= 1)
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" className="shrink-0" aria-hidden>
        <circle cx="7" cy="7" r="6" fill={m.color} />
        <path d="m4.3 7.2 1.9 1.9 3.6-3.8" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  const a = m.fill * 2 * Math.PI;
  const r = 3.5;
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className="shrink-0" aria-hidden>
      <circle cx="7" cy="7" r="5.5" fill="none" stroke={m.color} strokeWidth="1.5" strokeDasharray={m.dashed ? '2.2 1.8' : undefined} />
      {m.fill > 0 && (
        <path
          d={`M7 7 L7 ${7 - r} A${r} ${r} 0 ${m.fill > 0.5 ? 1 : 0} 1 ${(7 + r * Math.sin(a)).toFixed(2)} ${(7 - r * Math.cos(a)).toFixed(2)} Z`}
          fill={m.color}
        />
      )}
    </svg>
  );
}
export function StatusLabel({ status }: { status: Issue['status'] }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <StatusIcon status={status} />
      {statusMeta[status]?.label ?? label(status)}
    </span>
  );
}
export function StatusPill({ status }: { status: Issue['status'] }) {
  return (
    <span className="inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-2 text-xs font-medium">
      <StatusIcon status={status} size={13} />
      {statusMeta[status]?.label ?? label(status)}
    </span>
  );
}

/* Priority: signal bars; critical is a red badge. */
const level: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
export function PriorityIcon({ priority, size = 14 }: { priority: string; size?: number }) {
  const n = level[priority] ?? 2;
  if (n === 4)
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" className="shrink-0" aria-hidden>
        <rect x="1" y="1" width="12" height="12" rx="3" fill="#e5484d" />
        <path d="M7 4v3.6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="7" cy="10" r=".95" fill="#fff" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className="shrink-0 text-ink-2" aria-hidden>
      {[
        [2, 9, 3],
        [6, 6, 6],
        [10, 3, 9],
      ].map(([x, y, h], i) => (
        <rect key={i} x={x - 0.3} y={y + 0.5} width="2.6" height={h} rx=".8" fill={i < n ? 'currentColor' : 'var(--line-2)'} />
      ))}
    </svg>
  );
}
export function PriorityLabel({ priority }: { priority: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <PriorityIcon priority={priority} />
      {label(priority)}
    </span>
  );
}

/* Issue types */
export const typeMeta: Record<Issue['issue_type'], { color: string; Icon: typeof Bug }> = {
  EPIC: { color: '#7c3aed', Icon: Zap },
  STORY: { color: '#16a34a', Icon: Bookmark },
  TASK: { color: '#2563eb', Icon: SquareCheck },
  BUG: { color: '#e5484d', Icon: Bug },
  SUBTASK: { color: '#6b6f7a', Icon: CornerDownRight },
};
export function TypeIcon({ type, size = 16 }: { type: Issue['issue_type']; size?: number }) {
  const m = typeMeta[type] ?? typeMeta.TASK;
  return (
    <span
      title={label(type)}
      className="inline-flex shrink-0 items-center justify-center rounded-[4px] text-white"
      style={{ width: size, height: size, background: m.color }}
    >
      <m.Icon style={{ width: size - 6, height: size - 6 }} strokeWidth={2.6} />
    </span>
  );
}

/* Test results */
export function ResultBadge({ status }: { status: string }) {
  return <Badge value={status} dot />;
}

export const IssueKey = ({ children, className }: { children: string; className?: string }) => (
  <span className={`whitespace-nowrap font-mono text-xs text-ink-3 ${className ?? ''}`}>{children}</span>
);

export function Points({ value }: { value: number }) {
  return (
    <span className="tnum inline-flex h-5 min-w-[22px] items-center justify-center rounded-[5px] bg-hover px-1.5 text-[11.5px] font-semibold text-ink-2">
      {value}
    </span>
  );
}

/** GitHub mark (brand icons are not part of lucide). */
export function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className ?? 'size-3.5'} aria-hidden>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}
