import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  lines,
  ...props
}: SkeletonProps) {
  const baseStyles = 'animate-pulse bg-gradient-to-r from-dark-800 via-dark-700 to-dark-800 bg-[length:200%_100%] rounded';

  const variants = {
    text: 'h-4 rounded-full',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
    card: 'rounded-2xl',
  };

  const widths = {
    text: 'w-full',
    circular: 'w-10 h-10',
    rectangular: 'w-full h-32',
    card: 'w-full',
  };

  const heights = {
    text: 'h-4',
    circular: 'h-10',
    rectangular: 'h-32',
    card: 'h-64',
  };

  if (variant === 'text' && lines && lines > 1) {
    return (
      <div className={cn('space-y-3', className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(baseStyles, variants.text, i === lines - 1 ? 'w-3/4' : 'w-full')}
            style={{ width: i === lines - 1 ? '75%' : '100%' }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(baseStyles, variants[variant], className)}
      style={{
        width: width ?? widths[variant],
        height: height ?? heights[variant],
      }}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="card-hover animate-in">
      <Skeleton variant="rectangular" className="mb-4" />
      <div className="space-y-3">
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" lines={2} />
      </div>
    </div>
  );
}

export function MediaCardSkeleton() {
  return (
    <div className="card-hover animate-in">
      <Skeleton variant="rectangular" className="aspect-video mb-4 rounded-xl" />
      <div className="space-y-3">
        <Skeleton variant="text" width="70%" />
        <Skeleton variant="text" width="40%" />
        <div className="flex flex-wrap gap-2">
          <Skeleton variant="text" width="80px" height="24px" className="rounded-full" />
          <Skeleton variant="text" width="80px" height="24px" className="rounded-full" />
          <Skeleton variant="text" width="80px" height="24px" className="rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function InputSkeleton() {
  return (
    <div className="w-full">
      <Skeleton variant="text" width="30%" className="mb-2" />
      <Skeleton variant="text" className="rounded-xl h-12" />
    </div>
  );
}

export function ButtonSkeleton() {
  return (
    <Skeleton variant="text" width="160px" height="44px" className="rounded-xl" />
  );
}