import * as React from 'react';
import { Link, type To } from 'react-router-dom';
import { Button as AntButton, type ButtonProps as AntButtonProps } from 'antd';

type Variant = 'default' | 'outline' | 'ghost' | 'destructive';

const variants: Record<Variant, Pick<AntButtonProps, 'type' | 'danger'>> = {
  default: { type: 'primary' },
  outline: { type: 'default' },
  ghost: { type: 'text' },
  destructive: { type: 'default', danger: true },
};

export interface ButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'color'
> {
  variant?: Variant;
  type?: 'button' | 'submit' | 'reset';
  icon?: React.ReactNode;
  loading?: boolean;
  size?: AntButtonProps['size'];
  block?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', type = 'button', ...props }, ref) => (
    <AntButton ref={ref} htmlType={type} {...variants[variant]} {...props} />
  ),
);
Button.displayName = 'Button';

/** A router link styled as a button. */
export function LinkButton({
  to,
  variant = 'default',
  children,
  ...props
}: {
  to: To;
  variant?: Variant;
  children: React.ReactNode;
  icon?: React.ReactNode;
  size?: AntButtonProps['size'];
  className?: string;
}) {
  return (
    <Link to={to} className="link-button">
      <AntButton tabIndex={-1} {...variants[variant]} {...props}>
        {children}
      </AntButton>
    </Link>
  );
}
