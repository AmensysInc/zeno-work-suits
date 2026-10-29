'use client';

import type { ReactNode } from 'react';
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A centered dialog with a header, scrollable body and optional footer. */
export function Dialog({
  open = true,
  onClose,
  title,
  description,
  children,
  footer,
  width = 540,
  className,
}: {
  open?: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  className?: string;
}) {
  return (
    <D.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-[var(--overlay)] data-[state=open]:animate-in" />
        <D.Content
          style={{ width: `min(${width}px, calc(100vw - 32px))` }}
          className={cn(
            'fixed left-1/2 top-[8vh] z-50 flex max-h-[84vh] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-lg outline-none',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-[18px] py-3.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <D.Title className="text-[14px] font-semibold">{title}</D.Title>
              {description ? (
                <D.Description className="text-xs text-ink-3">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</D.Description>
              )}
            </div>
            <D.Close className="-mr-1 rounded-md p-1 text-ink-3 hover:bg-hover hover:text-ink" aria-label="Close">
              <X className="size-4" />
            </D.Close>
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto p-[18px]">{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-line bg-subtle px-[18px] py-3">
              {footer}
            </div>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
