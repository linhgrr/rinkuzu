import React from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant =
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
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    // Map variants to our design system base classes defined in globals.css
    // or provide inline tailwind classes for the ones not explicitly defined there.
    const variants: Record<string, string> = {
      default: 'btn-primary', // maps default to primary orange
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      outline: 'btn-secondary', // outline maps to secondary
      ghost: 'btn-ghost',
      success: 'btn-success',
      destructive:
        'bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500 shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-sm)] transform active:translate-y-0 hover:-translate-y-[1px]',
      link: 'text-neutral-600 hover:text-brand-trust hover:underline underline-offset-4 p-0 h-auto bg-transparent',
      gradient: 'btn-primary', // gracefully map deprecated variants
      accent: 'btn-primary',
    };

    const sizes: Record<string, string> = {
      sm: 'h-[36px] px-4 text-[14px]',
      md: '', // base size is defined in globals.css for these components
      lg: 'h-[52px] px-8 text-[16px] rounded-[var(--radius-lg)]',
      xl: 'h-[60px] px-10 text-[18px] rounded-[var(--radius-xl)]',
      icon: 'h-[44px] w-[44px] p-0 rounded-full',
    };

    return (
      <button
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
              className="h-4 w-4 animate-spin text-current"
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
        <span className={cn('flex items-center gap-2', loading ? 'invisible' : '')}>
          {children}
        </span>
      </button>
    );
  },
);

Button.displayName = 'Button';

export { Button };
