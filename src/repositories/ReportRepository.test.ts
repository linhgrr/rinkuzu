import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  lean: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({ default: mocks.connectDB }));
vi.mock('@/models/Report', () => ({
  default: { findByIdAndUpdate: mocks.findByIdAndUpdate },
}));

import { ReportRepository } from '@/repositories/ReportRepository';

describe('ReportRepository.update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lean.mockResolvedValue(null);
    mocks.findByIdAndUpdate.mockReturnValue({ lean: mocks.lean });
  });

  it('unsets stale resolution audit fields when a report is reopened', async () => {
    await new ReportRepository().update('report-1', {
      status: 'pending',
      resolution: null,
    });

    expect(mocks.findByIdAndUpdate).toHaveBeenCalledWith(
      'report-1',
      {
        $set: { status: 'pending' },
        $unset: { resolvedAt: 1, resolvedBy: 1 },
      },
      { new: true },
    );
  });

  it('persists complete resolution audit fields together', async () => {
    const resolvedAt = new Date('2026-07-15T00:00:00.000Z');

    await new ReportRepository().update('report-1', {
      status: 'resolved',
      resolution: { resolvedAt, resolvedBy: 'admin@example.com' },
      adminNotes: 'fixed',
    });

    expect(mocks.findByIdAndUpdate).toHaveBeenCalledWith(
      'report-1',
      {
        $set: {
          status: 'resolved',
          resolvedAt,
          resolvedBy: 'admin@example.com',
          adminNotes: 'fixed',
        },
      },
      { new: true },
    );
  });
});
