import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/public-env', () => ({
  publicEnv: { NEXT_PUBLIC_API_URL: 'https://adaptive.example.test' },
}));
vi.mock('@/lib/env', () => ({
  env: { ADAPTIVE_PROXY_TIMEOUT_MS: 1000, INTERNAL_SERVICE_TOKEN: 't' },
}));

import { buildAdaptiveInfraUrl, buildAdaptiveUrl } from './config';

describe('adaptive URL builders', () => {
  it('versioned paths get the /api/v1 prefix', () => {
    expect(buildAdaptiveUrl('/history/subjects')).toBe(
      'https://adaptive.example.test/api/v1/history/subjects',
    );
  });

  it('infra paths get the bare /api prefix (no version)', () => {
    // Regression guard: health/ready/live/info are unversioned on the backend.
    // Routing them through buildAdaptiveUrl produced /api/v1/health → 404.
    expect(buildAdaptiveInfraUrl('/health')).toBe('https://adaptive.example.test/api/health');
  });
});
