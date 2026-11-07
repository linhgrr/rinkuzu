'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { claimStoredGuestAttempts } from '@/features/quiz/api/guest-claim-api';

/**
 * Once the learner is signed in, hands the guest results this browser kept to
 * their account (RIN-912 part 4). Mounted once, next to the session provider.
 * Renders nothing.
 */
export function GuestAttemptClaimer() {
  const { status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') void claimStoredGuestAttempts();
  }, [status]);

  return null;
}
