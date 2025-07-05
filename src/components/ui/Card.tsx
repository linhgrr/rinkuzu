import React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'glass' | 'elevated' | 'bordered' | 'gradient';
    hover?: boolean;
  }
>(({ className, variant = 'default', hover = false, ...props }, ref) => {
  const variants = {
    default: 'bg-white/90 backdrop-blur-sm border border-white/20 shadow-soft',
    glass: 'bg-white/20 backdrop-blur-md border border-white/30 shadow-medium',
    elevated: 'bg-white shadow-strong border border-gray-100',
    bordered: 'bg-white border-2 border-gray-200 shadow-sm',
    gradient: 'bg-gradient-to-br from-white to-gray-50 border border-white/20 shadow-soft',
  };

  const hoverEffects = hover ? 'hover:shadow-xl hover:transform hover:-translate-y-1 hover:scale-[1.02]' : '';

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl text-gray-950 transition-all duration-300',
        variants[variant],
        hoverEffects,
        className
      )}
      {...props}
    />
  );
});
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-2 p-3', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement> & {
    size?: 'sm' | 'md' | 'lg' | 'xl';
  }
>(({ className, size = 'md', ...props }, ref) => {
  const sizes = {
    sm: 'text-lg font-semibold',
    md: 'text-xl font-semibold',
    lg: 'text-2xl font-bold',
    xl: 'text-3xl font-bold',
  };

  return (
    <h3
      ref={ref}
      className={cn(
        'leading-tight tracking-tight text-gray-900',
        sizes[size],
        className
      )}
      {...props}
    />
  );
});
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-gray-600 leading-relaxed', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

// Badge component for status indicators
const Badge = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
    size?: 'sm' | 'md' | 'lg';
  }
>(({ className, variant = 'default', size = 'sm', children, ...props }, ref) => {
  const variants = {
    default: 'bg-gray-100 text-gray-700 border border-gray-200',
    success: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-100 text-amber-700 border border-amber-200',
    danger: 'bg-red-100 text-red-700 border border-red-200',
    info: 'bg-blue-100 text-blue-700 border border-blue-200',
    purple: 'bg-violet-100 text-violet-700 border border-violet-200',
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <div
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full font-medium transition-colors',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
Badge.displayName = 'Badge';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, Badge }; 