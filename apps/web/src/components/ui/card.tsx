import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/** Returns a bordered surface that groups related content. */
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-xl border border-border bg-card p-4 text-fg shadow-sm', className)}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

/** Returns the padded header area of a card. */
export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mb-3 flex flex-col gap-1', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

/** Returns a card heading with a consistent size. */
export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn('text-lg font-semibold leading-tight', className)} {...props} />
  ),
);
CardTitle.displayName = 'CardTitle';

/** Returns the body area of a card. */
export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-sm leading-relaxed', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';
