import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn.js';

const fieldBase =
  'w-full rounded-lg border border-border bg-surface text-base text-text placeholder:text-muted transition-colors focus:border-accent';
// Single-line fields are a fixed 48px tall.
const inputBase = 'h-[48px] px-4';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className, ...props },
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
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cn(fieldBase, inputBase, error && 'border-danger', className)}
        {...props}
      />
      {hint && !error && (
        <p id={`${fieldId}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, id, className, ...props },
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
      <textarea
        ref={ref}
        id={fieldId}
        aria-invalid={!!error}
        className={cn(
          fieldBase,
          'min-h-[120px] resize-y px-4 py-3',
          error && 'border-danger',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
});
