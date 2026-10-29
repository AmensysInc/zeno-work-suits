'use client';

import type { ReactNode } from 'react';
import * as S from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Option<V extends string | number = string | number> = {
  value: V;
  label: ReactNode;
  /** Plain text for the trigger when `label` is rich. */
  text?: string;
  icon?: ReactNode;
  disabled?: boolean;
};
export type OptionGroup<V extends string | number = string | number> = {
  label: string;
  options: Option<V>[];
};

// Radix needs non-empty string values; keep the original value type for callers.
const EMPTY = '__empty__';
const enc = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === '' ? EMPTY : `${typeof v}:${v}`;

export function Select<V extends string | number>({
  value,
  onChange,
  options = [],
  groups,
  placeholder = 'Select…',
  disabled,
  className,
  size = 'md',
  'aria-label': ariaLabel,
  id,
}: {
  value: V | null | undefined;
  onChange: (value: V) => void;
  options?: Option<V>[];
  groups?: OptionGroup<V>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  'aria-label'?: string;
  id?: string;
}) {
  const all = [...options, ...(groups ?? []).flatMap((g) => g.options)];
  const byKey = new Map(all.map((o) => [enc(o.value), o]));
  const current = byKey.get(enc(value));
  const h = size === 'lg' ? 'h-[38px]' : size === 'sm' ? 'h-[26px] text-xs' : 'h-8';
  const item = (o: Option<V>) => (
    <S.Item
      key={enc(o.value)}
      value={enc(o.value)}
      disabled={o.disabled}
      className="relative flex cursor-default select-none items-center gap-2 rounded-md py-1.5 pl-2 pr-7 text-[13px] text-ink outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-hover"
    >
      {o.icon}
      <S.ItemText>{o.label}</S.ItemText>
      <S.ItemIndicator className="absolute right-2">
        <Check className="size-3.5 text-accent" />
      </S.ItemIndicator>
    </S.Item>
  );
  return (
    <S.Root
      value={enc(value)}
      onValueChange={(k) => {
        const o = byKey.get(k);
        if (o) onChange(o.value);
      }}
      disabled={disabled}
    >
      <S.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          'inline-flex min-w-0 items-center gap-2 rounded-md border border-line-2 bg-surface px-2.5 text-left text-[13px] text-ink shadow-sm outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--ring)] disabled:opacity-60 data-[placeholder]:text-ink-3',
          h,
          className,
        )}
      >
        {current?.icon}
        <span className="min-w-0 flex-1 truncate">
          {current ? (current.text ?? current.label) : <span className="text-ink-3">{placeholder}</span>}
        </span>
        <S.Icon>
          <ChevronDown className="size-3.5 text-ink-3" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-[min(var(--radix-select-content-available-height),360px)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-line bg-raised p-1 shadow-lg"
        >
          <S.Viewport className="scrollbar-thin">
            {options.map(item)}
            {groups?.map((g) =>
              g.options.length ? (
                <S.Group key={g.label}>
                  <S.Label className="caps px-2 pb-1 pt-2">{g.label}</S.Label>
                  {g.options.map(item)}
                </S.Group>
              ) : null,
            )}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
