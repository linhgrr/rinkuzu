import React from 'react';
import { HiOutlineExclamationCircle } from 'react-icons/hi';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  inputSize?: 'sm' | 'md' | 'lg';
  error?: string;
  label?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  ref?: React.Ref<HTMLInputElement>;
}

function Input({
  className,
  inputSize = 'md',
  error,
  label,
  icon,
  iconPosition = 'left',
  id,
  ref,
  ...props
}: InputProps) {
  const reactId = React.useId();
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : reactId);

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-[12px] font-semibold text-neutral-700">
          {label}
        </label>
      )}

      <div className="relative">
        {icon && iconPosition === 'left' && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400">
            <div className={iconSizes[inputSize]}>{icon}</div>
          </div>
        )}

        <input
          id={inputId}
          className={cn(
            'input',
            inputSize === 'sm' && 'h-[36px] text-[14px]',
            inputSize === 'lg' && 'h-[52px] text-[16px]',
            icon && iconPosition === 'left' && 'pl-10',
            icon && iconPosition === 'right' && 'pr-10',
            error &&
              'border-red-500 focus-visible:border-red-500 focus-visible:shadow-[0_0_0_3px_rgba(229,72,77,0.22)]',
            className,
          )}
          ref={ref}
          {...props}
        />

        {icon && iconPosition === 'right' && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400">
            <div className={iconSizes[inputSize]}>{icon}</div>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-sm text-red-500 flex items-center">
          <HiOutlineExclamationCircle className="size-4 mr-1 flex-shrink-0" />
          {error}
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
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : reactId);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={textareaId}
          className="mb-1 block text-[12px] font-semibold text-neutral-700"
        >
          {label}
        </label>
      )}

      <textarea
        id={textareaId}
        className={cn(
          'input !h-auto min-h-[100px] resize-y py-2.5',
          error &&
            'border-red-500 focus-visible:border-red-500 focus-visible:shadow-[0_0_0_3px_rgba(229,72,77,0.22)]',
          className,
        )}
        ref={ref}
        {...props}
      />

      {error && (
        <p className="mt-1.5 text-sm text-red-500 flex items-center">
          <HiOutlineExclamationCircle className="size-4 mr-1 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

Textarea.displayName = 'Textarea';

export { Input, Textarea };
