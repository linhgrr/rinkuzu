'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import {
  capturePendingAnalyticsLogin,
  capturePendingAnalyticsSignup,
  getAnalyticsConsent,
  identifyAnalyticsUser,
  subscribeToAnalyticsConsent,
} from '@/lib/analytics/client';

export function AnalyticsIdentity() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const role = session?.user?.role;
  const isNewAccount = session?.user?.isNewAccount === true;
  const consent = useSyncExternalStore(
    subscribeToAnalyticsConsent,
    getAnalyticsConsent,
    () => null,
  );

  useEffect(() => {
    if (!userId || consent !== 'granted') return;
    void identifyAnalyticsUser(userId, { role }).then(() => {
      capturePendingAnalyticsSignup();
      capturePendingAnalyticsLogin({ isNewAccount });
    });
  }, [consent, isNewAccount, role, userId]);

  return null;
}
