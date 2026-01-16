import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link' | 'gradient' | 'accent';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'icon';
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const variants = {
      default: 'bg-[#0071e3] text-white hover:bg-[#0077ED] shadow-apple-sm hover:shadow-apple-md active:scale-[0.98]',
      primary: 'bg-[#0071e3] text-white hover:bg-[#0077ED] shadow-apple-sm hover:shadow-apple-md active:scale-[0.98]',
      secondary: 'bg-gray-100 text-[#1d1d1f] hover:bg-gray-200 active:scale-[0.98]',
      outline: 'border border-gray-300 bg-white text-[#1d1d1f] hover:bg-gray-50 active:scale-[0.98]',
      ghost: 'text-[#0071e3] hover:bg-blue-50 active:scale-[0.98]',
      destructive: 'bg-[#ff3b30] text-white hover:bg-[#ff453a] shadow-apple-sm hover:shadow-apple-md active:scale-[0.98]',
      link: 'text-[#0071e3] hover:underline underline-offset-4 p-0 h-auto',
      gradient: 'bg-[#0071e3] text-white hover:bg-[#0077ED] shadow-apple-sm hover:shadow-apple-md active:scale-[0.98]',
      accent: 'bg-[#5ac8fa] text-white hover:bg-[#4ab8ea] shadow-apple-sm hover:shadow-apple-md active:scale-[0.98]',
    };

    const sizes = {
      sm: 'h-9 px-4 text-sm rounded-full',
      md: 'h-11 px-6 text-sm rounded-full',
      lg: 'h-12 px-8 text-base rounded-full',
      xl: 'h-14 px-10 text-base rounded-full',
      icon: 'h-10 w-10 rounded-full',
    };

    return (
      <button
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all duration-200 ease-apple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap',
          variants[variant],
          variant !== 'link' && sizes[size],
          loading && 'relative',
          className
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <>
            <div className="absolute inset-0 bg-inherit rounded-full opacity-80" />
            <div className="relative flex items-center">
              <svg
                className="mr-2 h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
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
              <span className="opacity-70">Loading...</span>
            </div>
          </>
        )}
        {!loading && (
          <span className="relative z-10 flex items-center gap-2">
            {children}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
