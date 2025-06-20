import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'glass' | 'outlined' | 'filled';
  size?: 'sm' | 'md' | 'lg';
  error?: string;
  label?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className, 
    variant = 'default', 
    size = 'md', 
    error, 
    label, 
    icon, 
    iconPosition = 'left',
    id,
    ...props 
  }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    
    const variants = {
      default: 'bg-white/80 backdrop-blur-sm border border-gray-200 hover:border-gray-300 focus:border-primary focus:ring-primary/20',
      glass: 'bg-white/20 backdrop-blur-md border border-white/30 hover:border-white/40 focus:border-white/60 focus:ring-white/20',
      outlined: 'bg-transparent border-2 border-gray-300 hover:border-gray-400 focus:border-primary focus:ring-primary/20',
      filled: 'bg-gray-50 border border-transparent hover:bg-gray-100 focus:bg-white focus:border-primary focus:ring-primary/20',
    };

    const sizes = {
      sm: 'h-10 px-3 py-2 text-sm',
      md: 'h-12 px-4 py-3 text-sm',
      lg: 'h-14 px-5 py-4 text-base',
    };

    const iconSizes = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6',
    };

    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={inputId}
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            {label}
          </label>
        )}
        
        <div className="relative">
          {icon && iconPosition === 'left' && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <div className={iconSizes[size]}>
                {icon}
              </div>
            </div>
          )}
          
          <input
            id={inputId}
            className={cn(
              'w-full rounded-xl font-medium transition-all duration-300 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-gray-400',
              variants[variant],
              sizes[size],
              icon && iconPosition === 'left' && 'pl-10',
              icon && iconPosition === 'right' && 'pr-10',
              error && 'border-red-300 focus:border-red-500 focus:ring-red-200',
              className
            )}
            ref={ref}
            {...props}
          />
          
          {icon && iconPosition === 'right' && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <div className={iconSizes[size]}>
                {icon}
              </div>
            </div>
          )}
        </div>
        
        {error && (
          <p className="mt-2 text-sm text-red-600 flex items-center">
            <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Textarea component
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    variant?: 'default' | 'glass' | 'outlined' | 'filled';
    error?: string;
    label?: string;
  }
>(({ className, variant = 'default', error, label, id, ...props }, ref) => {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');
  
  const variants = {
    default: 'bg-white/80 backdrop-blur-sm border border-gray-200 hover:border-gray-300 focus:border-primary focus:ring-primary/20',
    glass: 'bg-white/20 backdrop-blur-md border border-white/30 hover:border-white/40 focus:border-white/60 focus:ring-white/20',
    outlined: 'bg-transparent border-2 border-gray-300 hover:border-gray-400 focus:border-primary focus:ring-primary/20',
    filled: 'bg-gray-50 border border-transparent hover:bg-gray-100 focus:bg-white focus:border-primary focus:ring-primary/20',
  };

  return (
    <div className="w-full">
      {label && (
        <label 
          htmlFor={textareaId}
          className="block text-sm font-semibold text-gray-700 mb-2"
        >
          {label}
        </label>
      )}
      
      <textarea
        id={textareaId}
        className={cn(
          'w-full rounded-xl px-4 py-3 font-medium transition-all duration-300 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-gray-400 resize-none',
          variants[variant],
          error && 'border-red-300 focus:border-red-500 focus:ring-red-200',
          className
        )}
        ref={ref}
        {...props}
      />
      
      {error && (
        <p className="mt-2 text-sm text-red-600 flex items-center">
          <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export { Input, Textarea }; 