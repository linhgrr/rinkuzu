'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { DraftSyncProvider } from '@/components/providers/DraftSyncProvider';
import { Toaster } from 'sonner';

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider
      refetchInterval={0}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <DraftSyncProvider>
        {children}
        <Toaster richColors position="top-right" />
      </DraftSyncProvider>
    </SessionProvider>
  );
} 
