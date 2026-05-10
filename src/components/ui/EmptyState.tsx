'use client';

import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title = 'No data found',
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`py-12 text-center ${className}`.trim()}>
      {icon && <div className="mb-4 flex justify-center">{icon}</div>}
      {title && <h3 className="text-lg font-medium text-neutral-900">{title}</h3>}
      {description && <p className="mt-1 text-sm text-neutral-600">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
