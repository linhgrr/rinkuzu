import React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'interactive' | 'elevated' | 'bordered' | 'glass' | 'gradient';
    hover?: boolean;
  }
>(({ className, variant = 'default', hover = false, ...props }, ref) => {
  const variants = {
    default: 'card',
    interactive: 'feature-card card-interactive',
    elevated: 'card shadow-[var(--shadow-md)]',
    bordered: 'card border-[var(--border-strong)] shadow-none',
    glass: 'card bg-white/80 backdrop-blur-xl',
    gradient: 'card',
  };

  return (
    <div
      ref={ref}
      className={cn(
        variants[variant],
        hover && variant !== 'interactive'
          ? 'transition-[transform,box-shadow] duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)] hover:-translate-y-[1px] hover:shadow-[var(--shadow-sm)]'
          : '',
        className,
      )}
      {...props}
    />
  );
});
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1.5 px-6 pt-6 pb-0', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement> & {
    size?: 'sm' | 'md' | 'lg' | 'xl';
  }
>(({ className, size = 'md', ...props }, ref) => {
  const sizes = {
    sm: 'text-[16px] font-semibold tracking-[-0.015em]',
    md: 'text-[18px] font-semibold tracking-[-0.015em]',
    lg: 'text-[24px] font-semibold tracking-[-0.025em]',
    xl: 'text-[32px] font-[700] tracking-[-0.025em]',
  };

  const { children, ...restProps } = props;

  return (
    <h3 ref={ref} className={cn('text-neutral-900', sizes[size], className)} {...restProps}>
      {children}
    </h3>
  );
});
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-[14px] text-neutral-500 leading-[1.5]', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-4', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  ),
);
CardFooter.displayName = 'CardFooter';

const Badge = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'ai';
    size?: 'sm' | 'md' | 'lg';
  }
>(({ className, variant = 'default', size = 'sm', children, ...props }, ref) => {
  const variants = {
    default: 'badge-gray',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'bg-[rgba(229,72,77,0.1)] text-red-500',
    info: 'badge-info',
    purple: 'badge-success',
    ai: 'badge-ai',
  };

  const sizes = {
    sm: 'badge text-[13px]',
    md: 'badge min-h-[30px] px-[14px] text-[13px]',
    lg: 'badge min-h-[32px] px-[16px] text-[14px]',
  };

  return (
    <div ref={ref} className={cn(variants[variant], sizes[size], className)} {...props}>
      {children}
    </div>
  );
});
Badge.displayName = 'Badge';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, Badge };
