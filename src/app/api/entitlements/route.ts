import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import {
  can,
  isMeteredCapabilityEnabled,
  resolveEntitlements,
  type MeteredCapability,
} from '@/lib/entitlements';
import { getLlmUsageSnapshot } from '@/lib/llm/rate-limit';
import { logger } from '@/lib/logger';
import type { EntitlementSnapshot } from '@/types/entitlements';

export const dynamic = 'force-dynamic';

const METERED_CAPABILITIES: MeteredCapability[] = [
  'ask_rin_chan',
  'quiz_extract',
  'adaptive_pipeline',
  'adaptive_generation',
];

export const GET = withAuth(async (_request, { userId, session }) => {
  try {
    const entitlements = await resolveEntitlements(userId);
    const isAdmin = session.user.role === 'admin';
    const meteredEntries = await Promise.all(
      METERED_CAPABILITIES.map(async (capability) => {
        const windows = isAdmin
          ? []
          : (await getLlmUsageSnapshot(userId, capability, entitlements)).map((item) => ({
              window: item.window,
              used: item.count,
              limit: item.limit,
              remaining: item.remaining,
              resetsAt: item.resetAt.toISOString(),
            }));
        return [
          capability,
          {
            kind: 'metered' as const,
            enabled: isAdmin || isMeteredCapabilityEnabled(entitlements, capability),
            ...(isAdmin ? { unmetered: true } : {}),
            windows,
          },
        ] as const;
      }),
    );

    const snapshot: EntitlementSnapshot = {
      tier: isAdmin ? 'premium' : entitlements.tier,
      capabilities: {
        private_quiz: { kind: 'boolean', enabled: isAdmin || can(entitlements, 'private_quiz') },
        ...Object.fromEntries(meteredEntries),
      } as EntitlementSnapshot['capabilities'],
    };
    return apiOk(snapshot, 200, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error) {
    logger.error({ error, userId }, 'Failed to resolve entitlement snapshot');
    return apiErr('entitlement_unavailable', 'Entitlements are temporarily unavailable', 503);
  }
});
