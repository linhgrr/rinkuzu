'use client';

import { useSession } from 'next-auth/react';
import { GuestResumeBanner, type GuestResumeBannerProps } from './GuestResumeBanner';

/**
 * The banner on pages under a `SessionProvider` (the app shell and its cached signed-out
 * twins): hidden unless the session is known to be signed out (RIN-1710 AC 3). The
 * marketing pages mount `GuestResumeBanner` directly: no provider, no session request.
 */
export function GuestResumeBannerForApp(props: Omit<GuestResumeBannerProps, 'enabled'>) {
  const { status } = useSession();
  return <GuestResumeBanner {...props} enabled={status === 'unauthenticated'} />;
}
