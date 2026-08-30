'use client';

import useSWR from 'swr';

import { fetchProfileEntitlements } from '@/features/profile/api/profile-entitlements-api';
import type { EntitlementSnapshot } from '@/types/entitlements';

const ENTITLEMENTS_KEY = '/api/entitlements';

/**
 * The single reader of the entitlements snapshot.
 *
 * SWR registers focus and interval revalidators per mounted hook, all of them
 * against the shared key, so the loosest policy any mounted caller declares is
 * the policy the key gets. Two callers used to declare opposite ones -- the
 * profile quota card polled every minute and revalidated on focus, while the
 * PDF upload policy asked for neither -- which meant the second caller's
 * setting only held while the first was off screen. Whether a page revalidated
 * depended on what else happened to be mounted beside it.
 *
 * One hook, one policy. It is the quota card's: a quota that reads stale is the
 * failure the user notices, and an entitlement snapshot is small.
 */
export function useEntitlementSnapshot() {
  return useSWR<EntitlementSnapshot>(ENTITLEMENTS_KEY, fetchProfileEntitlements, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  });
}
