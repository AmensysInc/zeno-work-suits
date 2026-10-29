import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

const control =
  'w-full rounded-md border border-line-2 bg-surface text-[13px] text-ink placeholder:text-ink-3 transition-[border,box-shadow] outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--ring)] disabled:bg-subtle disabled:text-ink-3 aria-[invalid=true]:border-red-400';

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  icon?: ReactNode;
  suffix?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, icon, suffix, size = 'md', ...props },
  ref,
) {
  const h = size === 'lg' ? 'h-[38px]' : size === 'sm' ? 'h-7' : 'h-8';
  if (!icon && !suffix)
    return <input ref={ref} className={cn(control, h, 'px-2.5', className)} {...props} />;
  return (
    <div className={cn('relative flex items-center', className)}>
      {icon && (
        <span className="pointer-events-none absolute left-2.5 text-ink-3 [&_svg]:size-3.5">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        className={cn(control, h, icon ? 'pl-8' : 'pl-2.5', suffix ? 'pr-8' : 'pr-2.5')}
        {...props}
      />
      {suffix && <span className="absolute right-2 text-ink-3 [&_svg]:size-3.5">{suffix}</span>}
    </div>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(control, 'resize-y px-2.5 py-2 leading-relaxed', className)}
      {...props}
    />
  );
});

/** A labelled form control with optional help text and error. */
export function Field({
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[12.5px] font-medium text-ink">
        {label}
        {optional && <span className="font-normal text-ink-3"> · optional</span>}
      </label>
      {children(id)}
      {error ? (
        <span className="text-xs text-red-600">{error}</span>
      ) : (
        hint && <span className="text-xs text-ink-3">{hint}</span>
      )}
    </div>
  );
}
