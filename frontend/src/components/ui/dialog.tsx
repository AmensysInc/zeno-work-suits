import * as D from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <D.Portal>
        <D.Overlay className="overlay" />
        <D.Content
          className={wide ? 'modal modal-wide' : 'modal'}
          aria-describedby={undefined}
        >
          <div className="section-head">
            <D.Title>{title}</D.Title>
            <D.Close className="close" aria-label="Close">
              ×
            </D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
