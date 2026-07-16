import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { cn } from './cn.js';

interface Option {
  value: string;
  label: string;
}
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Option[];
  placeholder?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, placeholder, error, id, className, ...props },
  ref,
) {
  const genId = useId();
  const fieldId = id ?? genId;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={fieldId} className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={fieldId}
        aria-invalid={!!error}
        className={cn(
          'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text transition-colors focus:border-accent',
          error && 'border-danger',
          className,
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
});
