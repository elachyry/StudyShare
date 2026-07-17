import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn.js';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90 shadow-sm',
  secondary: 'bg-surface-2 text-text hover:bg-border',
  ghost: 'bg-transparent text-text hover:bg-surface-2',
  danger: 'bg-danger text-white hover:opacity-90',
  outline: 'border border-border bg-transparent text-text hover:bg-surface-2',
};
const SIZES: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-[48px] px-5 text-base',
  lg: 'h-[52px] px-7 text-base',
  icon: 'h-[48px] w-[48px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all active:scale-[0.98]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
