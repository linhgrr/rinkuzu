import { fetchApiData } from '@/lib/api/client';
import type { EntitlementSnapshot } from '@/types/entitlements';

export function fetchProfileEntitlements(): Promise<EntitlementSnapshot> {
  return fetchApiData('/api/entitlements', { cache: 'no-store' });
}
