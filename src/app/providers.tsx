'use client';

import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { UpgradePromptProvider } from '@/features/subscription/components/UpgradePromptProvider';

interface ProvidersProps {
  children: ReactNode;
  session?: Session | null;
}

export default function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider
      session={session}
      refetchInterval={0}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <UpgradePromptProvider>{children}</UpgradePromptProvider>
      <Toaster richColors position="top-right" />
    </SessionProvider>
  );
}
