'use client';

import { ReactNode } from 'react';

interface AdminPageShellProps {
  children: ReactNode;
  contentClassName?: string;
}

export function AdminPageShell({ children, contentClassName = '' }: AdminPageShellProps) {
  return (
    <div className="min-h-screen bg-surface-page font-home text-ink">
      <main className={`max-w-none px-4 py-8 sm:px-6 lg:px-8 ${contentClassName}`.trim()}>
        {children}
      </main>
    </div>
  );
}
