'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { DraftSyncProvider } from '@/components/providers/DraftSyncProvider';
import { Toaster } from 'sonner';
import { I18nProvider } from '@/lib/i18n';

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <I18nProvider>
        <DraftSyncProvider>
          {children}
          <Toaster richColors position="top-right" />
        </DraftSyncProvider>
      </I18nProvider>
    </SessionProvider>
  );
}
