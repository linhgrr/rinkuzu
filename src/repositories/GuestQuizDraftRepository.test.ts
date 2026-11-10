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
};

describe('GuestQuizDraftRepository', () => {
  const repository = new GuestQuizDraftRepository();
  beforeEach(() => vi.clearAllMocks());

  it('creates a processing draft and maps it to a record', async () => {
    model.create.mockResolvedValue({ toObject: () => stored });
    const record = await repository.create({
      tokenHash: 'a'.repeat(64),
      apiDraftId: 'api-draft-1',
      locale: 'en',
      entry: 'landing',
      expiresAt: new Date(0),
    });
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'processing' }));
    expect(record).toEqual({
      id: id.toString(),
      apiDraftId: 'api-draft-1',
      status: 'processing',
      title: null,
      questionCount: 0,
      locale: 'en',
      entry: 'landing',
      failureReason: null,
    });
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

  it('ignores an invalid id', async () => {
    expect(await repository.markFailed('nope', 'x')).toBe(false);
    expect(model.updateOne).not.toHaveBeenCalled();
  });
});
