'use client';

import type { ReactNode } from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as M from '@radix-ui/react-dropdown-menu';
import * as Pop from '@radix-ui/react-popover';
import * as Tip from '@radix-ui/react-tooltip';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  className,
  'aria-label': ariaLabel,
}: {
  checked: boolean | 'indeterminate';
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  const box = (
    <CheckboxPrimitive.Root
      checked={checked}
      onCheckedChange={(c) => onChange(c === true)}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={(e) => e.stopPropagation()}
      className="flex size-[15px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px] border-line-2 bg-surface data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent disabled:opacity-50"
    >
      <CheckboxPrimitive.Indicator className="text-white">
        {checked === 'indeterminate' ? (
          <Minus className="size-[11px]" strokeWidth={3} />
        ) : (
          <Check className="size-[11px]" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
  if (!label) return box;
  return (
    <label className={cn('inline-flex cursor-pointer items-start gap-2 text-[13px]', className)}>
      <span className="mt-0.5">{box}</span>
      <span>{label}</span>
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
      <SwitchPrimitive.Root
        checked={checked}
        onCheckedChange={onChange}
        className="relative h-[18px] w-[30px] shrink-0 rounded-full bg-line-2 transition-colors data-[state=checked]:bg-accent"
      >
        <SwitchPrimitive.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[14px]" />
      </SwitchPrimitive.Root>
      {label}
    </label>
  );
}

/** Underlined page tabs. */
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: { key: K; label: ReactNode; count?: number }[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('flex h-10 shrink-0 items-stretch gap-[18px] border-b border-line px-[18px]', className)}>
      {items.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={t.key === value}
          onClick={() => onChange(t.key)}
          className={cn(
            '-mb-px flex items-center gap-1.5 border-b-2 border-transparent text-[13px] font-medium text-ink-2 hover:text-ink',
            t.key === value && 'border-ink text-ink',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="tnum text-[11.5px] text-ink-3">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Compact segmented control. */
export function Segmented<K extends string>({
  items,
  value,
  onChange,
  className,
  'aria-label': ariaLabel,
}: {
  items: { key: K; label: ReactNode }[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('inline-flex gap-0.5 rounded-lg bg-hover p-0.5', className)}>
      {items.map((i) => (
        <button
          key={i.key}
          role="radio"
          aria-checked={i.key === value}
          onClick={() => onChange(i.key)}
          className={cn(
            'inline-flex h-[26px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] px-2.5 text-[12.5px] font-medium text-ink-2 hover:text-ink [&_svg]:size-3.5',
            i.key === value && 'bg-surface text-ink shadow-sm ring-1 ring-line',
          )}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function Menu({
  trigger,
  items,
  align = 'end',
}: {
  trigger: ReactNode;
  items: ({ label: ReactNode; icon?: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean } | 'separator')[];
  align?: 'start' | 'end';
}) {
  return (
    <M.Root>
      <M.Trigger asChild>{trigger}</M.Trigger>
      <M.Portal>
        <M.Content
          align={align}
          sideOffset={4}
          className="z-50 min-w-44 rounded-lg border border-line bg-raised p-1 shadow-lg"
        >
          {items.map((it, i) =>
            it === 'separator' ? (
              <M.Separator key={i} className="my-1 h-px bg-line" />
            ) : (
              <M.Item
                key={i}
                disabled={it.disabled}
                onSelect={it.onSelect}
                className={cn(
                  'flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-hover [&_svg]:size-3.5 [&_svg]:text-ink-3',
                  it.danger && 'text-red-600 [&_svg]:text-red-600',
                )}
              >
                {it.icon}
                {it.label}
              </M.Item>
            ),
          )}
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}

export function Popover({
  trigger,
  children,
  align = 'start',
  open,
  onOpenChange,
  className,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  return (
    <Pop.Root open={open} onOpenChange={onOpenChange}>
      <Pop.Trigger asChild>{trigger}</Pop.Trigger>
      <Pop.Portal>
        <Pop.Content
          align={align}
          sideOffset={4}
          className={cn('z-50 rounded-lg border border-line bg-raised p-1 shadow-lg outline-none', className)}
        >
          {children}
        </Pop.Content>
      </Pop.Portal>
    </Pop.Root>
  );
}

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <Tip.Root delayDuration={300}>
      <Tip.Trigger asChild>{children}</Tip.Trigger>
      <Tip.Portal>
        <Tip.Content sideOffset={6} className="z-50 rounded-md bg-ink px-2 py-1 text-xs text-surface shadow-lg">
          {content}
        </Tip.Content>
      </Tip.Portal>
    </Tip.Root>
  );
}
