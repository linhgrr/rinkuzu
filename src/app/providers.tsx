'use client';

import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { UpgradePromptProvider } from '@/features/subscription/components/UpgradePromptProvider';
import { AnalyticsIdentity } from '@/components/analytics/AnalyticsIdentity';
import { SingleSessionGuard } from '@/features/auth/components/SingleSessionGuard';

interface ProvidersProps {
  children: ReactNode;
  session?: Session | null;
}

export default function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider
      {...(session !== undefined ? { session } : {})}
      // SingleSessionGuard checks the session itself (one GET per check). The
      // provider poll costs two GETs per tick in next-auth 5 beta (RIN-687).
      refetchInterval={0}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <SingleSessionGuard />
      <AnalyticsIdentity />
      <UpgradePromptProvider>{children}</UpgradePromptProvider>
      <Toaster richColors position="top-right" />
    </SessionProvider>
  );
}
