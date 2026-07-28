'use client';

import React from 'react';
import { HiOutlineExclamationCircle } from 'react-icons/hi';
import { cn } from '@/lib/utils';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  selectSize?: 'sm' | 'md' | 'lg';
  ref?: React.Ref<HTMLSelectElement>;
}

function Select({
  className,
  label,
  helperText,
  error,
  selectSize = 'md',
  id,
  ref,
  'aria-describedby': ariaDescribedBy,
  ...props
}: SelectProps) {
  const reactId = React.useId();
  const selectId = id || reactId;
  const helperId = `${selectId}-helper`;
  const errorId = `${selectId}-error`;
  const describedBy = [
    ariaDescribedBy,
    helperText && !error ? helperId : undefined,
    error ? errorId : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="w-full font-home">
      {label ? (
        <label htmlFor={selectId} className="mb-1.5 block text-xs font-semibold text-ink">
          {label}
        </label>
      ) : null}

      <select
        id={selectId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          'input appearance-auto font-home text-ink',
          selectSize === 'sm' && 'h-9 text-xs',
          selectSize === 'md' && 'h-11 text-sm',
          selectSize === 'lg' && 'h-[52px] text-base',
          error &&
            'border-error focus-visible:border-error focus-visible:shadow-[0_0_0_3px_var(--focus-ring-error)]',
          className,
        )}
        {...props}
      />

      {error ? (
        <p id={errorId} className="mt-1.5 flex items-center font-home text-xs text-error">
          <HiOutlineExclamationCircle className="mr-1 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="mt-1.5 font-home text-xs text-ink-muted">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

Select.displayName = 'Select';

export { Select };
