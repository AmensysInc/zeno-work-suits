import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        secondary:
          'border-line-2 bg-surface text-ink shadow-sm hover:bg-hover [&_svg]:text-ink-2',
        primary:
          'border-accent-2 bg-accent text-white shadow-[inset_0_1px_0_rgba(255,255,255,.16),0_1px_2px_rgba(67,56,202,.35)] hover:bg-accent-2',
        ghost: 'border-transparent bg-transparent text-ink-2 hover:bg-hover hover:text-ink',
        danger:
          'border-red-200 bg-surface text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/40 [&_svg]:text-red-600',
        dark: 'border-ink bg-ink text-surface hover:opacity-90',
        success: 'border-green-700 bg-green-600 text-white hover:bg-green-700',
      },
      size: {
        sm: 'h-[26px] rounded-[6px] px-2 text-xs',
        md: 'h-[30px] px-[11px] text-[13px]',
        lg: 'h-9 rounded-lg px-3.5 text-[13.5px]',
        icon: 'size-7 p-0',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    icon?: ReactNode;
  };

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant, size, asChild, loading, icon, children, disabled, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || loading}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Loader2 className="animate-spin" /> : icon}
          {children}
        </>
      )}
    </Comp>
  );
});

export function LinkButton({
  href,
  variant,
  size,
  icon,
  className,
  children,
}: VariantProps<typeof buttonVariants> & {
  href: string;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)}>
      {icon}
      {children}
    </Link>
  );
}
