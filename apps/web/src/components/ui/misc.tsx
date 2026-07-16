import type { HTMLAttributes, ReactNode } from 'react';
import { Loader2, Star } from 'lucide-react';
import { cn } from './cn.js';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-surface-2', className)}
      aria-hidden
      {...props}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-accent', className)} aria-hidden />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-12 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <h3 className="text-lg font-medium text-text">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}

type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger' | 'warning';
const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-muted',
  accent: 'bg-accent/15 text-accent',
  success: 'bg-success/15 text-success',
  danger: 'bg-danger/15 text-danger',
  warning: 'bg-warning/15 text-warning',
};
export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Interactive or read-only 1–5 star rating. */
export function StarRating({
  value,
  onChange,
  readOnly,
  size = 20,
  label,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  size?: number;
  label?: string;
}) {
  return (
    <div className="inline-flex items-center gap-0.5" role={readOnly ? 'img' : 'radiogroup'} aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(value);
        const Icon = (
          <Star
            style={{ width: size, height: size }}
            className={filled ? 'fill-accent text-accent' : 'text-border'}
            aria-hidden
          />
        );
        return readOnly ? (
          <span key={star}>{Icon}</span>
        ) : (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === Math.round(value)}
            aria-label={`${star}`}
            onClick={() => onChange?.(star)}
            className="transition-transform hover:scale-110"
          >
            {Icon}
          </button>
        );
      })}
    </div>
  );
}
