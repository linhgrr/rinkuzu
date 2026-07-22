import { fetchApiData } from '@/lib/api/client';
import type { EntitlementTelemetry } from '@/lib/entitlements/telemetry';

export function fetchEntitlementTelemetry(url: string): Promise<EntitlementTelemetry> {
  return fetchApiData(url);
}
