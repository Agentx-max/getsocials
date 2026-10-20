import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'violet' | 'electric' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', dot, children, ...props }, ref) => {
    const variants = {
      default: 'bg-dark-700 text-dark-300 border border-dark-600',
      violet: 'badge-violet',
      electric: 'badge-electric',
      success: 'badge-success',
      warning: 'badge-warning',
      error: 'badge-error',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-[11px] gap-1',
      md: 'px-3 py-1 text-xs gap-1.5',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium rounded-full',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn('h-1.5 w-1.5 rounded-full', {
              'bg-flux-400': variant === 'violet',
              'bg-electric-400': variant === 'electric',
              'bg-green-400': variant === 'success',
              'bg-amber-400': variant === 'warning',
              'bg-red-400': variant === 'error',
              'bg-dark-400': variant === 'default',
            })}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';