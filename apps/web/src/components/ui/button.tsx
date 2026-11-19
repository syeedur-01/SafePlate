import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

export const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-fg shadow-sm hover:shadow-md active:opacity-90 disabled:shadow-none',
        secondary:
          'border border-border bg-card text-fg shadow-sm hover:border-primary hover:bg-muted active:opacity-90',
        ghost: 'text-fg hover:bg-muted hover:text-heading',
        destructive: 'bg-risk-high text-white shadow-sm hover:opacity-90',
        mint: 'bg-mint text-heading border border-primary hover:bg-primary hover:text-primary-fg',
      },
      size: {
        default: 'px-4',
        sm: 'px-3',
        lg: 'h-12 px-6 text-base',
        icon: 'w-11 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

/** Returns a 44px-minimum button with shadcn-style variants. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
