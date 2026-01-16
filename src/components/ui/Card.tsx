import React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'elevated' | 'bordered' | 'interactive' | 'glass' | 'gradient';
    hover?: boolean;
  }
>(({ className, variant = 'default', hover = false, ...props }, ref) => {
  const variants = {
    default: 'bg-white border border-gray-100 shadow-apple-sm',
    elevated: 'bg-white shadow-apple-md',
    bordered: 'bg-white border border-gray-200',
    interactive: 'bg-white border border-gray-100 shadow-apple-sm cursor-pointer',
    glass: 'bg-white/80 backdrop-blur-xl border border-gray-100 shadow-apple-sm',
    gradient: 'bg-white border border-gray-100 shadow-apple-sm',
  };

  const hoverEffects = hover
    ? 'hover:shadow-apple-lg hover:-translate-y-0.5 active:scale-[0.99]'
    : variant === 'interactive'
    ? 'hover:shadow-apple-lg hover:-translate-y-0.5 active:scale-[0.99]'
    : '';

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl transition-all duration-300 ease-apple',
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
    className={cn('flex flex-col gap-1.5 p-5 pb-0', className)}
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
    sm: 'text-base font-semibold',
    md: 'text-lg font-semibold',
    lg: 'text-xl font-semibold',
    xl: 'text-2xl font-semibold',
  };

  return (
    <h3
      ref={ref}
      className={cn(
        'text-[#1d1d1f] tracking-tight',
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
    className={cn('text-sm text-[#86868b] leading-relaxed', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-5 pt-3', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-5 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

// Apple-like Badge component
const Badge = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
    size?: 'sm' | 'md' | 'lg';
  }
>(({ className, variant = 'default', size = 'sm', children, ...props }, ref) => {
  const variants = {
    default: 'bg-gray-100 text-[#86868b]',
    success: 'bg-[#34c759]/10 text-[#248a3d]',
    warning: 'bg-[#ff9500]/10 text-[#c93400]',
    danger: 'bg-[#ff3b30]/10 text-[#ff3b30]',
    info: 'bg-[#0071e3]/10 text-[#0071e3]',
    purple: 'bg-[#af52de]/10 text-[#8944ab]',
  };

  const sizes = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-sm',
  };

  return (
    <div
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full font-medium',
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
