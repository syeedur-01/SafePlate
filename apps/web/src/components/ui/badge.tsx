import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

export const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-fg',
        secondary: 'border-border bg-muted text-fg',
        outline: 'border-border bg-transparent text-fg',
        estimated: 'border-risk-moderate text-risk-moderate',
        draft: 'border-risk-moderate text-risk-moderate',
        low: 'border-risk-low text-risk-low',
        moderate: 'border-risk-moderate text-risk-moderate',
        high: 'border-risk-high text-risk-high',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

/** Returns a compact label, always readable as text without relying on colour alone. */
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
