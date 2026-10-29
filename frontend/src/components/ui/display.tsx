import type { ReactNode } from 'react';
import { AlertTriangle, Info, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { label as enumLabel } from '@/types';
import { cn, initials } from '@/lib/utils';

export const tones = {
  gray: 'text-[#6b6f7a] bg-[#f0f0f3] dark:text-[#a3a6b1] dark:bg-[#24262f]',
  green: 'text-[#16a34a] bg-[#e8f7ee] dark:text-[#4ade80] dark:bg-[#1f3b2a]',
  amber: 'text-[#d97706] bg-[#fef4e2] dark:text-[#fbbf24] dark:bg-[#3a2e17]',
  red: 'text-[#e5484d] bg-[#fdecec] dark:text-[#f87171] dark:bg-[#3e1c1e]',
  blue: 'text-[#2563eb] bg-[#eaf1fe] dark:text-[#60a5fa] dark:bg-[#18264a]',
  violet: 'text-[#7c3aed] bg-[#f3eefe] dark:text-[#a78bfa] dark:bg-[#2c1f4a]',
  indigo: 'text-accent-ink bg-accent-soft',
  sky: 'text-[#0284c7] bg-[#e6f4fb] dark:text-[#38bdf8] dark:bg-[#14303f]',
} as const;
export type Tone = keyof typeof tones;

/** Enum values mapped to a tone, so `<Badge value="ACTIVE" />` just works. */
const valueTone: Record<string, Tone> = {
  ACTIVE: 'green', DONE: 'green', PASSED: 'green', READY: 'green', OPEN: 'green', COMPLETED: 'gray',
  PLANNED: 'blue', TODO: 'gray', BACKLOG: 'gray', IN_PROGRESS: 'amber', CODE_REVIEW: 'violet', TESTING: 'sky',
  FAILED: 'red', CRITICAL: 'red', AT_RISK: 'amber', GAP: 'amber', BLOCKED: 'amber', NOT_RUN: 'gray', SKIPPED: 'gray',
  HIGH: 'amber', MEDIUM: 'blue', LOW: 'gray', ADMIN: 'violet', MANAGER: 'blue', EMPLOYEE: 'gray',
  MERGED: 'violet', CLOSED: 'gray', DRAFT: 'gray', ARCHIVED: 'gray', INACTIVE: 'gray',
  INVITED: 'amber', DISABLED: 'gray',
};

export function Badge({
  value,
  tone,
  dot,
  icon,
  children,
  className,
}: {
  value?: string;
  tone?: Tone;
  dot?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const t = tone ?? (value ? valueTone[value.toUpperCase()] : undefined) ?? 'gray';
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[5px] px-[7px] text-[11.5px] font-semibold [&_svg]:size-3',
        tones[t],
        className,
      )}
    >
      {dot && <i className="block size-1.5 shrink-0 rounded-full bg-current" />}
      {icon}
      {children ?? (value ? enumLabel(value) : null)}
    </span>
  );
}

/** Small outlined tag for labels, projects and epics. */
export function Tag({ color, children, className }: { color?: string; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-5 max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-[7px] text-[11.5px] font-medium text-ink-2', className)}>
      {color && <i className="block size-[7px] shrink-0 rounded-full" style={{ background: color }} />}
      <span className="truncate">{children}</span>
    </span>
  );
}

const avatarColors = ['#4f46e5', '#db2777', '#0d9488', '#d97706', '#2563eb', '#7c3aed', '#0284c7', '#64748b'];
export const colorFor = (seed: number | string) => {
  const n = typeof seed === 'number' ? seed : [...seed].reduce((a, c) => a + c.charCodeAt(0), 0);
  return avatarColors[Math.abs(n) % avatarColors.length];
};

export function Avatar({
  user,
  size = 22,
  className,
}: {
  user?: { id?: number; first_name: string; last_name: string } | null;
  size?: number;
  className?: string;
}) {
  if (!user)
    return (
      <span
        title="Unassigned"
        className={cn('inline-block shrink-0 rounded-full border border-dashed border-ink-4', className)}
        style={{ width: size, height: size }}
      />
    );
  const c = colorFor(user.id ?? `${user.first_name}${user.last_name}`);
  return (
    <span
      title={`${user.first_name} ${user.last_name}`}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4), background: `${c}1f`, color: c, boxShadow: `inset 0 0 0 1px ${c}33` }}
    >
      {initials(user)}
    </span>
  );
}

export function AvatarStack({ users, size = 22, max = 5 }: { users: { id: number; first_name: string; last_name: string }[]; size?: number; max?: number }) {
  const shown = users.slice(0, max);
  return (
    <span className="inline-flex">
      {shown.map((u, i) => (
        <span key={u.id} className={cn('rounded-full ring-2 ring-surface', i && '-ml-1.5')}>
          <Avatar user={u} size={size} />
        </span>
      ))}
      {users.length > max && (
        <span
          className="-ml-1.5 inline-flex items-center justify-center rounded-full bg-hover text-[10px] font-semibold text-ink-2 ring-2 ring-surface"
          style={{ width: size, height: size }}
        >
          +{users.length - max}
        </span>
      )}
    </span>
  );
}

const projectColors = ['#4f46e5', '#0d9488', '#d97706', '#db2777', '#2563eb', '#7c3aed', '#0284c7', '#16a34a'];
export const projectColor = (id: number) => projectColors[id % projectColors.length];

export function ProjectMark({ project, size = 18 }: { project: { id: number; key: string }; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[5px] font-bold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.15)]"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: projectColor(project.id) }}
    >
      {project.key[0]}
    </span>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-lg border border-line bg-surface shadow-md', className)}>{children}</div>;
}
export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-4 pt-3.5', className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[15px] font-semibold tracking-tight">{title}</span>
        {subtitle && <span className="text-xs text-ink-3">{subtitle}</span>}
      </div>
      {action}
    </div>
  );
}

export function Note({
  tone = 'gray',
  icon,
  children,
  className,
}: {
  tone?: 'gray' | 'amber' | 'red' | 'green' | 'blue' | 'indigo';
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    gray: 'bg-hover text-ink-2',
    amber: 'bg-[#fef4e2] text-[#92400e] dark:bg-[#3a2e17] dark:text-[#fcd34d]',
    red: 'bg-[#fdecec] text-[#7f1d1d] dark:bg-[#3e1c1e] dark:text-[#fca5a5]',
    green: 'bg-[#e8f7ee] text-[#14532d] dark:bg-[#1f3b2a] dark:text-[#86efac]',
    blue: 'bg-[#eaf1fe] text-[#1e3a8a] dark:bg-[#18264a] dark:text-[#93c5fd]',
    indigo: 'bg-accent-soft text-accent-ink',
  }[tone];
  const defaultIcon = { gray: <Info />, amber: <AlertTriangle />, red: <XCircle />, green: <CheckCircle2 />, blue: <Info />, indigo: <Info /> }[tone];
  return (
    <div role={tone === 'red' ? 'alert' : undefined} className={cn('flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-[12.5px] leading-normal [&>svg]:mt-px [&>svg]:size-[15px] [&>svg]:shrink-0', styles, className)}>
      {icon ?? defaultIcon}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Empty({ icon, title, children, className }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-12 text-center', className)}>
      {icon && <div className="mb-1 flex size-11 items-center justify-center rounded-xl bg-hover text-ink-3 [&_svg]:size-5">{icon}</div>}
      <span className="text-[14px] font-semibold">{title}</span>
      {children && <div className="max-w-sm text-[13px] text-ink-2">{children}</div>}
    </div>
  );
}

/** Loading, error and empty states for a query. Renders nothing when there is data. */
export function State({ loading, error, empty, emptyText }: { loading?: boolean; error?: unknown; empty?: boolean; emptyText?: ReactNode }) {
  if (loading)
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-12 text-ink-3">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-[13px]">Loading…</span>
      </div>
    );
  if (error)
    return (
      <div className="p-4">
        <Note tone="red">Unable to load this page. Please refresh and try again.</Note>
      </div>
    );
  if (empty) return <Empty title="Nothing here yet">{emptyText ?? 'Create your first item to get started.'}</Empty>;
  return null;
}

export function Kpi({ label, value, hint, tone, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5 px-4 py-3.5', className)}>
      <span className="text-[12.5px] font-medium text-ink-2">{label}</span>
      <span className="tnum text-[22px] font-semibold leading-none tracking-tight" style={tone ? { color: tone } : undefined}>
        {value}
      </span>
      {hint && <span className="text-[11.5px] text-ink-3">{hint}</span>}
    </div>
  );
}

export function Progress({ parts, className }: { parts: { value: number; color: string }[]; className?: string }) {
  return (
    <div className={cn('flex h-1.5 overflow-hidden rounded-full bg-hover', className)}>
      {parts.map((p, i) => (
        <i key={i} className="block h-full" style={{ width: `${Math.max(0, Math.min(100, p.value))}%`, background: p.color }} />
      ))}
    </div>
  );
}
