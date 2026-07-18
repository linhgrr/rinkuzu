import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/public-env', () => ({
  publicEnv: { NEXT_PUBLIC_API_URL: 'https://adaptive.example.test' },
}));
vi.mock('@/lib/env', () => ({
  env: {
    ADAPTIVE_PROXY_TIMEOUT_MS: 1000,
    // Non-secret CI/test fixture; must match vitest/CI/e2e/perf/Docker fallbacks.
    INTERNAL_SERVICE_TOKEN: 'rinkuzu-ci-fixture-0123456789abcdef-token',
  },
}));

import { buildAdaptiveInfraUrl, buildAdaptiveServiceHeaders, buildAdaptiveUrl } from './config';

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

describe('buildAdaptiveServiceHeaders', () => {
  it('always emits x-service-token and only optional user headers when provided', () => {
    expect(buildAdaptiveServiceHeaders()).toEqual({
      'x-service-token': 'rinkuzu-ci-fixture-0123456789abcdef-token',
    });

    expect(buildAdaptiveServiceHeaders('user-1')).toEqual({
      'x-user-id': 'user-1',
      'x-service-token': 'rinkuzu-ci-fixture-0123456789abcdef-token',
    });

    expect(buildAdaptiveServiceHeaders('user-1', 'admin')).toEqual({
      'x-user-id': 'user-1',
      'x-user-role': 'admin',
      'x-service-token': 'rinkuzu-ci-fixture-0123456789abcdef-token',
    });

    expect(buildAdaptiveServiceHeaders(undefined, 'user')).toEqual({
      'x-user-role': 'user',
      'x-service-token': 'rinkuzu-ci-fixture-0123456789abcdef-token',
    });

    expect(buildAdaptiveServiceHeaders('user-1', null)).toEqual({
      'x-user-id': 'user-1',
      'x-service-token': 'rinkuzu-ci-fixture-0123456789abcdef-token',
    });
  });
});
