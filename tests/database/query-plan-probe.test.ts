import { describe, expect, it, vi } from 'vitest';

import { withCleanProbeRows } from '../../scripts/database/query-plan-probe.mjs';

describe('withCleanProbeRows', () => {
  const marker = { _ciQueryPlanProbe: true };

  it('cleans stale and inserted probe rows around a successful probe', async () => {
    const collection = { deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }) };
    const runProbe = vi.fn().mockResolvedValue('evidence');

    await expect(withCleanProbeRows([collection], marker, runProbe)).resolves.toBe('evidence');

    expect(runProbe).toHaveBeenCalledOnce();
    expect(collection.deleteMany).toHaveBeenCalledTimes(2);
    expect(collection.deleteMany).toHaveBeenNthCalledWith(1, marker);
    expect(collection.deleteMany).toHaveBeenNthCalledWith(2, marker);
    const firstCleanupOrder = collection.deleteMany.mock.invocationCallOrder[0];
    const probeOrder = runProbe.mock.invocationCallOrder[0];
    const finalCleanupOrder = collection.deleteMany.mock.invocationCallOrder[1];
    if (
      firstCleanupOrder === undefined ||
      probeOrder === undefined ||
      finalCleanupOrder === undefined
    ) {
      throw new Error('Expected call-order evidence for both cleanup phases and the probe');
    }
    expect(firstCleanupOrder).toBeLessThan(probeOrder);
    expect(probeOrder).toBeLessThan(finalCleanupOrder);
  });

  it('cleans inserted rows when the probe fails', async () => {
    const probeError = new Error('IXSCAN assertion failed');
    const collection = { deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }) };

    await expect(
      withCleanProbeRows([collection], marker, async () => {
        throw probeError;
      }),
    ).rejects.toBe(probeError);

    expect(collection.deleteMany).toHaveBeenCalledTimes(2);
  });

  it('fails before probing when stale-row cleanup fails', async () => {
    const cleanupError = new Error('cleanup unavailable');
    const collection = { deleteMany: vi.fn().mockRejectedValue(cleanupError) };
    const runProbe = vi.fn();

    await expect(withCleanProbeRows([collection], marker, runProbe)).rejects.toBe(cleanupError);

    expect(runProbe).not.toHaveBeenCalled();
    expect(collection.deleteMany).toHaveBeenCalledOnce();
  });

  it('preserves both failures when the probe and final cleanup fail', async () => {
    const probeError = new Error('IXSCAN assertion failed');
    const cleanupError = new Error('cleanup unavailable');
    const collection = {
      deleteMany: vi
        .fn()
        .mockResolvedValueOnce({ deletedCount: 0 })
        .mockRejectedValueOnce(cleanupError),
    };

    const rejection = withCleanProbeRows([collection], marker, async () => {
      throw probeError;
    });

    await expect(rejection).rejects.toMatchObject({
      message: 'Query-plan probe and marker cleanup both failed',
      errors: [probeError, cleanupError],
    });
    expect(collection.deleteMany).toHaveBeenCalledTimes(2);
  });
});
