import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Plain table with the v2 look; wraps in a horizontal scroller on narrow screens. */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('scrollbar-thin w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  );
}
export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('h-[34px] whitespace-nowrap border-b border-line bg-surface px-3 text-left text-xs font-medium text-ink-3 first:pl-[18px] last:pr-[18px]', className)} {...props} />;
}
export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('h-11 border-b border-line px-3 align-middle first:pl-[18px] last:pr-[18px]', className)} {...props} />;
}
export function Tr({ className, selected, ...props }: HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }) {
  return <tr className={cn('hover:bg-subtle', selected && 'bg-sel hover:bg-sel', props.onClick && 'cursor-pointer', className)} {...props} />;
}
