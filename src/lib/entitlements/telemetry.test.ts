import { beforeEach, describe, expect, it, vi } from 'vitest';

const { aggregateMock, connectDBMock, toArrayMock } = vi.hoisted(() => ({
  aggregateMock: vi.fn(),
  connectDBMock: vi.fn(),
  toArrayMock: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({ default: connectDBMock }));
vi.mock('mongoose', () => ({
  default: {
    connection: {
      db: {
        collection: () => ({ aggregate: aggregateMock }),
      },
    },
  },
}));

import { getEntitlementTelemetry } from './telemetry';

describe('getEntitlementTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectDBMock.mockResolvedValue(undefined);
    aggregateMock.mockReturnValue({ toArray: toArrayMock });
  });

  it('maps totals and per-capability rows without accumulating user-id arrays', async () => {
    toArrayMock.mockResolvedValue([
      {
        totals: [{ attempts: 8, committed: 5, refunded: 1, denied: 1, inFlight: 1, stale: 0 }],
        uniqueUsers: [{ count: 3 }],
        byCapability: [
          {
            _id: { capability: 'ask_rin_chan', tier: 'free' },
            attempts: 8,
            committed: 5,
            refunded: 1,
            denied: 1,
            stale: 0,
            uniqueUsers: 3,
          },
        ],
      },
    ]);

    await expect(getEntitlementTelemetry(30)).resolves.toEqual({
      windowDays: 30,
      totals: {
        attempts: 8,
        committed: 5,
        refunded: 1,
        denied: 1,
        inFlight: 1,
        stale: 0,
        uniqueUsers: 3,
      },
      byCapability: [
        {
          capability: 'ask_rin_chan',
          tier: 'free',
          attempts: 8,
          committed: 5,
          refunded: 1,
          denied: 1,
          stale: 0,
          uniqueUsers: 3,
        },
      ],
    });

    const pipeline = aggregateMock.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(JSON.stringify(pipeline)).not.toContain('$addToSet');
    expect(JSON.stringify(pipeline)).toContain('uniqueUsers');
  });

  it('returns a complete zero snapshot when the time window is empty', async () => {
    toArrayMock.mockResolvedValue([{ totals: [], uniqueUsers: [], byCapability: [] }]);

    await expect(getEntitlementTelemetry(7)).resolves.toEqual({
      windowDays: 7,
      totals: {
        attempts: 0,
        committed: 0,
        refunded: 0,
        denied: 0,
        inFlight: 0,
        stale: 0,
        uniqueUsers: 0,
      },
      byCapability: [],
    });
  });
});
