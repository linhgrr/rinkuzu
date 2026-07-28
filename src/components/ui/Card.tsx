import React from 'react';
import { cn } from '@/lib/utils';

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'interactive' | 'elevated' | 'bordered' | 'glass' | 'gradient';
  hover?: boolean;
  ref?: React.Ref<HTMLDivElement>;
};

function Card({ className, variant = 'default', hover = false, ref, ...props }: CardProps) {
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
}
Card.displayName = 'Card';

type CardHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
  ref?: React.Ref<HTMLDivElement>;
};

function CardHeader({ className, ref, ...props }: CardHeaderProps) {
  return (
    <div ref={ref} className={cn('flex flex-col gap-1.5 px-6 pt-6 pb-0', className)} {...props} />
  );
}
CardHeader.displayName = 'CardHeader';

type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement> & {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  ref?: React.Ref<HTMLHeadingElement>;
};

function CardTitle({ className, size = 'md', ref, ...props }: CardTitleProps) {
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
}
CardTitle.displayName = 'CardTitle';

type CardDescriptionProps = React.HTMLAttributes<HTMLParagraphElement> & {
  ref?: React.Ref<HTMLParagraphElement>;
};

function CardDescription({ className, ref, ...props }: CardDescriptionProps) {
  return (
    <p
      ref={ref}
      className={cn('text-[14px] text-neutral-500 leading-[1.5]', className)}
      {...props}
    />
  );
}
CardDescription.displayName = 'CardDescription';

type CardContentProps = React.HTMLAttributes<HTMLDivElement> & {
  ref?: React.Ref<HTMLDivElement>;
};

function CardContent({ className, ref, ...props }: CardContentProps) {
  return <div ref={ref} className={cn('p-6 pt-4', className)} {...props} />;
}
CardContent.displayName = 'CardContent';

type BadgeProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'ai';
  size?: 'sm' | 'md' | 'lg';
  ref?: React.Ref<HTMLDivElement>;
};

function Badge({
  className,
  variant = 'default',
  size = 'sm',
  children,
  ref,
  ...props
}: BadgeProps) {
  const variants = {
    default: 'badge-gray',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'bg-[rgba(229,72,77,0.1)] text-red-500',
    info: 'badge-info',
    purple: 'badge-purple',
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
}
Badge.displayName = 'Badge';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge };
