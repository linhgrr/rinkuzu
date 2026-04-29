'use client';

import { ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Sidebar from '@/components/Sidebar';

interface AdminPageShellProps {
  children: ReactNode;
  contentClassName?: string;
}

export function AdminPageShell({ children, contentClassName = '' }: AdminPageShellProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen((prev) => !prev)}
        currentPath={pathname}
      />
      <main
        className={`max-w-none px-4 py-8 transition-[margin] duration-300 sm:px-6 lg:px-8 ${isSidebarOpen ? 'ml-64' : 'ml-16'} ${contentClassName}`.trim()}
      >
        {children}
      </main>
    </div>
  );
}
