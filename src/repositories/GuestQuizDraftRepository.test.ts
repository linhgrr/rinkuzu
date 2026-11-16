import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { model } = vi.hoisted(() => ({
  model: { create: vi.fn(), findOne: vi.fn(), updateOne: vi.fn() },
}));

vi.mock('@/lib/mongoose', () => ({ default: vi.fn() }));
vi.mock('@/models/GuestQuizDraft', () => ({ default: model }));

import { GuestQuizDraftRepository } from '@/repositories/GuestQuizDraftRepository';

const id = new Types.ObjectId();
const stored = {
  _id: id,
  apiDraftId: 'api-draft-1',
  status: 'processing',
  questions: [],
  locale: 'en',
  entry: 'landing',
  createdAt: new Date('2026-11-10T03:00:00.000Z'),
};

describe('GuestQuizDraftRepository', () => {
  const repository = new GuestQuizDraftRepository();
  beforeEach(() => vi.clearAllMocks());

  it('creates a processing draft and maps it to a record', async () => {
    model.create.mockResolvedValue({ toObject: () => ({ ...stored, source: 'text' }) });
    const record = await repository.create({
      tokenHash: 'a'.repeat(64),
      apiDraftId: 'api-draft-1',
      locale: 'en',
      entry: 'landing',
      source: 'text',
      expiresAt: new Date(0),
    });
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processing', source: 'text' }),
    );
    expect(record).toEqual({
      id: id.toString(),
      apiDraftId: 'api-draft-1',
      status: 'processing',
      title: null,
      questionCount: 0,
      pageCount: null,
      complete: false,
      completion: null,
      locale: 'en',
      entry: 'landing',
      source: 'text',
      failureReason: null,
      createdAt: new Date('2026-11-10T03:00:00.000Z'),
    });
  });

  it('reads a draft stored before RIN-1538 (no source) as a PDF draft', async () => {
    const exec = vi.fn().mockResolvedValueOnce(stored);
    model.findOne.mockReturnValue({ lean: () => ({ exec }) });

    expect(await repository.findByTokenHash('h')).toMatchObject({ source: 'pdf' });
  });

  it('finds by token hash, or returns null', async () => {
    const exec = vi.fn().mockResolvedValueOnce({ ...stored, title: 'T', failureReason: 'x' });
    exec.mockResolvedValueOnce(null);
    model.findOne.mockReturnValue({ lean: () => ({ exec }) });

    expect(await repository.findByTokenHash('h')).toMatchObject({ title: 'T', failureReason: 'x' });
    expect(await repository.findByTokenHash('h')).toBeNull();
  });

  it('transitions only a processing draft and reports whether it won', async () => {
    model.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });
    model.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });

    expect(await repository.markReady(id.toString(), { title: 'T', questions: [] })).toBe(true);
    expect(await repository.markFailed(id.toString(), 'ocr_failed')).toBe(false);
    expect(model.updateOne.mock.calls[0]?.[0]).toEqual({ _id: id, status: 'processing' });
    expect(model.updateOne.mock.calls[1]?.[1]).toEqual({
      $set: { status: 'failed', failureReason: 'ocr_failed' },
    });
  });

  it('reads only a ready draft as a playable quiz with question ids', async () => {
    const questionId = new Types.ObjectId();
    const exec = vi.fn().mockResolvedValueOnce({
      _id: id,
      status: 'ready',
      title: 'Cells',
      questions: [
        { _id: questionId, question: 'Q1?', options: ['a', 'b'], type: 'single', correctIndex: 1 },
      ],
    });
    exec.mockResolvedValueOnce(null);
    model.findOne.mockReturnValue({ lean: () => ({ exec }) });

    expect(await repository.findReadyByTokenHash('h')).toEqual({
      id: id.toString(),
      title: 'Cells',
      questions: [
        {
          id: questionId.toString(),
          question: 'Q1?',
          options: ['a', 'b'],
          type: 'single',
          correctIndex: 1,
        },
      ],
      complete: true,
      completion: 'full',
    });
    expect(model.findOne).toHaveBeenCalledWith(
      { tokenHash: 'h', status: 'ready' },
      { status: 1, title: 1, questions: 1, complete: 1, completion: 1 },
    );
    expect(await repository.findReadyByTokenHash('h')).toBeNull();
  });

  it('ignores an invalid id', async () => {
    expect(await repository.markFailed('nope', 'x')).toBe(false);
    expect(
      await repository.completeDraft('nope', { storedCount: 0, questions: [], completion: 'full' }),
    ).toBe(false);
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('marks a direct ready draft complete, full unless told otherwise (RIN-1619)', async () => {
    model.updateOne.mockResolvedValue({ modifiedCount: 1 });

    await repository.markReady(id.toString(), { title: 'T', questions: [] });
    await repository.markReady(id.toString(), {
      title: 'T',
      questions: [],
      completion: 'first_batch_only',
    });

    expect(model.updateOne.mock.calls[0]?.[1]).toEqual({
      $set: { status: 'ready', title: 'T', questions: [], complete: true, completion: 'full' },
    });
    expect(model.updateOne.mock.calls[1]?.[1]).toMatchObject({
      $set: { completion: 'first_batch_only' },
    });
  });

  it('stores a first batch as ready but incomplete, only from processing (RIN-1619)', async () => {
    model.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });
    const questions = [
      { question: 'Q1?', options: ['a', 'b'], type: 'single' as const, correctIndex: 0 },
    ];

    expect(await repository.storeFirstBatch(id.toString(), { title: 'Quiz', questions })).toBe(
      true,
    );
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: id, status: 'processing' },
      { $set: { status: 'ready', title: 'Quiz', questions, complete: false } },
      { runValidators: true },
    );
  });

  it('appends the rest guarded on the stored count, keeping the title when none is given', async () => {
    model.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });
    model.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
    const rest = [
      { question: 'Q3?', options: ['a', 'b'], type: 'single' as const, correctIndex: 0 },
    ];

    expect(
      await repository.completeDraft(id.toString(), {
        storedCount: 2,
        questions: rest,
        title: 'Cells',
        completion: 'full',
      }),
    ).toBe(true);
    expect(
      await repository.completeDraft(id.toString(), {
        storedCount: 2,
        questions: [],
        completion: 'first_batch_only',
      }),
    ).toBe(false);

    expect(model.updateOne.mock.calls[0]).toEqual([
      { _id: id, status: 'ready', complete: false, questions: { $size: 2 } },
      {
        $push: { questions: { $each: rest } },
        $set: { complete: true, completion: 'full', title: 'Cells' },
      },
      { runValidators: true },
    ]);
    expect(model.updateOne.mock.calls[1]?.[1]).toEqual({
      $push: { questions: { $each: [] } },
      $set: { complete: true, completion: 'first_batch_only' },
    });
  });

  it('reads a ready draft with no complete field (before RIN-1619) as complete', async () => {
    const exec = vi.fn();
    exec.mockResolvedValueOnce({ ...stored, status: 'ready' });
    exec.mockResolvedValueOnce({ ...stored, status: 'ready', complete: false });
    exec.mockResolvedValueOnce({
      ...stored,
      status: 'ready',
      complete: true,
      completion: 'first_batch_only',
    });
    model.findOne.mockReturnValue({ lean: () => ({ exec }) });

    expect(await repository.findByTokenHash('h')).toMatchObject({
      complete: true,
      completion: 'full',
    });
    expect(await repository.findByTokenHash('h')).toMatchObject({
      complete: false,
      completion: null,
    });
    expect(await repository.findByTokenHash('h')).toMatchObject({
      complete: true,
      completion: 'first_batch_only',
    });
  });
});
