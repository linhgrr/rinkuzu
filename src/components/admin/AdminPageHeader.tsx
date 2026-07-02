import type { ReactNode } from 'react';

interface AdminPageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function AdminPageHeader({ title, description, actions }: AdminPageHeaderProps) {
  return (
    <div className="mb-8 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900">{title}</h1>
        {description ? <p className="mt-2 text-neutral-600">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
