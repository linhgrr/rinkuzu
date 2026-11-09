import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  lean: vi.fn(),
  aggregate: vi.fn(),
  countDocuments: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({ default: mocks.connectDB }));
vi.mock('@/models/Report', () => ({
  default: {
    findByIdAndUpdate: mocks.findByIdAndUpdate,
    aggregate: mocks.aggregate,
    countDocuments: mocks.countDocuments,
    create: mocks.create,
  },
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

describe('ReportRepository quiz-page reports (RIN-1343)', () => {
  const createdAt = new Date('2026-11-10T00:00:00.000Z');
  const record = {
    _id: '507f191e810c19729de860ec',
    quizId: '507f191e810c19729de860ea',
    quizTitle: 'Algebra',
    quizSlug: 'algebra',
    reason: 'copyright',
    source: 'quiz_page',
    ipHash: 'hash-1',
    status: 'pending',
    createdAt,
    updatedAt: createdAt,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists copyright/personal-data first, filters by reason and never returns the hash', async () => {
    mocks.aggregate.mockResolvedValue([record]);
    mocks.countDocuments.mockResolvedValue(1);

    const result = await new ReportRepository().findAll({
      page: 2,
      limit: 10,
      status: 'pending',
      reason: 'copyright',
    });

    const [pipeline] = mocks.aggregate.mock.calls[0] ?? [];
    expect(pipeline[0]).toEqual({ $match: { status: 'pending', reason: 'copyright' } });
    expect(pipeline[1].$addFields.holdRank.$cond[0]).toEqual({
      $in: ['$reason', ['copyright', 'personal_data']],
    });
    expect(pipeline.slice(2)).toEqual([
      { $sort: { holdRank: 1, createdAt: -1, _id: -1 } },
      { $skip: 10 },
      { $limit: 10 },
      { $project: { holdRank: 0, ipHash: 0 } },
    ]);
    expect(mocks.countDocuments).toHaveBeenCalledWith({ status: 'pending', reason: 'copyright' });
    expect(result.items[0]).toMatchObject({ reason: 'copyright', source: 'quiz_page' });
    expect(result.items[0]).not.toHaveProperty('ipHash');
  });

  it('counts pending hold reports for one quiz or all quizzes', async () => {
    mocks.countDocuments.mockResolvedValue(3);

    await new ReportRepository().countPendingIndexHoldReports('quiz-1');
    await new ReportRepository().countPendingIndexHoldReports();

    expect(mocks.countDocuments).toHaveBeenNthCalledWith(1, {
      status: 'pending',
      reason: { $in: ['copyright', 'personal_data'] },
      quizId: 'quiz-1',
    });
    expect(mocks.countDocuments).toHaveBeenNthCalledWith(2, {
      status: 'pending',
      reason: { $in: ['copyright', 'personal_data'] },
    });
  });

  it('creates a pending quiz-page report and hides the hash from the entity', async () => {
    mocks.create.mockResolvedValue({ toObject: () => record });

    const report = await new ReportRepository().createQuizPageReport({
      quizId: record.quizId,
      quizTitle: 'Algebra',
      quizSlug: 'algebra',
      reason: 'copyright',
      ipHash: 'hash-1',
    });

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'quiz_page', status: 'pending', ipHash: 'hash-1' }),
    );
    expect(report).not.toHaveProperty('ipHash');
    expect(report.reporterEmail).toBe('');
  });
});
