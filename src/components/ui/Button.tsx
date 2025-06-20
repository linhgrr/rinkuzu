import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'gradient' | 'accent';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'xl';
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', loading, disabled, children, ...props }, ref) => {
    const variants = {
      default: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 shadow-md hover:shadow-lg',
      destructive: 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-lg hover:shadow-xl',
      outline: 'border-2 border-primary/20 bg-white/80 hover:bg-primary/5 hover:border-primary/40 backdrop-blur-sm text-primary',
      secondary: 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 border border-gray-200 hover:from-gray-100 hover:to-gray-200 shadow-sm hover:shadow-md',
      ghost: 'hover:bg-white/50 backdrop-blur-sm text-gray-600 hover:text-gray-900',
      link: 'text-primary underline-offset-4 hover:underline p-0 h-auto',
      gradient: 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg hover:shadow-xl hover:from-violet-600 hover:to-purple-700',
      accent: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg hover:shadow-xl hover:from-cyan-600 hover:to-blue-700',
    };

    const sizes = {
      default: 'h-11 px-6 py-2 text-sm',
      sm: 'h-9 rounded-xl px-4 text-sm',
      lg: 'h-12 rounded-xl px-8 text-base',
      xl: 'h-14 rounded-2xl px-10 text-lg',
      icon: 'h-10 w-10',
    };

    const getHoverEffect = (variant: string) => {
      if (['gradient', 'accent', 'destructive'].includes(variant)) {
        return 'hover:transform hover:-translate-y-0.5 hover:scale-[1.02]';
      }
      return 'hover:transform hover:-translate-y-0.5';
    };

    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap',
          variants[variant],
          sizes[size],
          getHoverEffect(variant),
          loading && 'relative',
          className
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <>
            <div className="absolute inset-0 bg-inherit rounded-xl opacity-80" />
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