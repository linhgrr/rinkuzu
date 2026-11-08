import React from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'success'
  | 'destructive'
  | 'default'
  | 'outline'
  | 'link'
  | 'gradient'
  | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

function Button({
  className,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  children,
  ref,
  ...props
}: ButtonProps) {
  const variants: Record<string, string> = {
    default: 'btn-primary',
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    outline: 'btn-secondary',
    ghost: 'btn-ghost',
    success: 'btn-success',
    destructive:
      'border border-transparent bg-error text-white shadow-[var(--shadow-xs)] transition-[background-color,transform,box-shadow] hover:-translate-y-[1px] hover:brightness-90 hover:shadow-[var(--shadow-sm)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring-error)] active:translate-y-0',
    link: 'h-auto rounded-none bg-transparent p-0 text-neutral-600 underline-offset-4 transition-colors hover:text-brand-trust hover:underline',
    gradient: 'btn-primary',
    accent: 'btn-primary',
  };

  const sizes: Record<string, string> = {
    sm: 'h-9 px-3 text-xs font-medium',
    md: '', // base size is defined in globals.css for these components
    lg: 'h-[52px] px-8 text-[16px] rounded-[var(--radius-lg)]',
    xl: 'h-[60px] px-10 text-[18px] rounded-[var(--radius-xl)]',
    icon: 'h-[44px] w-[44px] p-0 rounded-[var(--radius-full)]',
  };

  return (
    <button
      type="button"
      className={cn(
        'btn',
        variants[variant],
        variant !== 'link' && sizes[size],
        loading && 'opacity-70 pointer-events-none relative',
        className,
      )}
      ref={ref}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-inherit rounded-[inherit]">
          <svg
            className="size-4 animate-spin text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}
      <span className={cn('flex items-center gap-2', loading ? 'invisible' : '')}>{children}</span>
    </button>
  );
}

Button.displayName = 'Button';

export { Button };
