'use client';

import React from 'react';
import { HiOutlineExclamationCircle } from 'react-icons/hi';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  inputSize?: 'sm' | 'md' | 'lg';
  error?: string;
  /** Helper text under the field; hidden while an error is shown. */
  hint?: string;
  label?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  ref?: React.Ref<HTMLInputElement>;
}

function Input({
  className,
  inputSize = 'md',
  error,
  hint,
  label,
  icon,
  iconPosition = 'left',
  id,
  ref,
  ...props
}: InputProps) {
  const reactId = React.useId();
  const inputId = id || reactId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const showHint = Boolean(hint) && !error;
  // Screen readers read the error (or hint) with the field, not only on its own (RIN-1017).
  const describedBy =
    [props['aria-describedby'], showHint ? hintId : null, error ? errorId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className="w-full font-home">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block font-home text-xs font-semibold text-ink">
          {label}
        </label>
      )}

      <div className="relative">
        {icon && iconPosition === 'left' && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-muted">
            <div className={iconSizes[inputSize]}>{icon}</div>
          </div>
        )}

        <input
          id={inputId}
          className={cn(
            'input font-home text-ink placeholder:text-ink-muted',
            inputSize === 'sm' && 'h-9 text-xs',
            inputSize === 'md' && 'h-11 text-sm',
            inputSize === 'lg' && 'h-[52px] text-base',
            icon && iconPosition === 'left' && 'pl-10',
            icon && iconPosition === 'right' && 'pr-10',
            error &&
              'border-error focus-visible:border-error focus-visible:shadow-[0_0_0_3px_var(--focus-ring-error)]',
            className,
          )}
          ref={ref}
          {...props}
          aria-invalid={error ? true : props['aria-invalid']}
          aria-describedby={describedBy}
        />

        {icon && iconPosition === 'right' && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-ink-muted">
            <div className={iconSizes[inputSize]}>{icon}</div>
          </div>
        )}
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 flex items-center font-home text-xs text-error"
        >
          <HiOutlineExclamationCircle className="size-4 mr-1 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {showHint && (
        <p id={hintId} className="mt-1.5 font-home text-xs text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

Input.displayName = 'Input';

// Textarea component
type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: string;
  label?: string;
  ref?: React.Ref<HTMLTextAreaElement>;
};

function Textarea({ className, error, label, id, ref, ...props }: TextareaProps) {
  const reactId = React.useId();
  const textareaId = id || reactId;

  return (
    <div className="w-full font-home">
      {label && (
        <label
          htmlFor={textareaId}
          className="mb-1.5 block font-home text-xs font-semibold text-ink"
        >
          {label}
        </label>
      )}

      <textarea
        id={textareaId}
        className={cn(
          'input !h-auto min-h-[100px] resize-y p-3 font-home text-sm text-ink placeholder:text-ink-muted',
          error &&
            'border-error focus-visible:border-error focus-visible:shadow-[0_0_0_3px_var(--focus-ring-error)]',
          className,
        )}
        ref={ref}
        {...props}
      />

      {error && (
        <p className="mt-1.5 flex items-center font-home text-xs text-error">
          <HiOutlineExclamationCircle className="size-4 mr-1 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

Textarea.displayName = 'Textarea';

export { Input, Textarea };
