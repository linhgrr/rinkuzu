'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import {
  capturePendingAnalyticsLogin,
  getAnalyticsConsent,
  identifyAnalyticsUser,
  subscribeToAnalyticsConsent,
} from '@/lib/analytics/client';

export function AnalyticsIdentity() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const role = session?.user?.role;
  const consent = useSyncExternalStore(
    subscribeToAnalyticsConsent,
    getAnalyticsConsent,
    () => null,
  );

  useEffect(() => {
    if (!userId || consent !== 'granted') return;
    void identifyAnalyticsUser(userId, { role }).then(capturePendingAnalyticsLogin);
  }, [consent, role, userId]);

  return null;
}
