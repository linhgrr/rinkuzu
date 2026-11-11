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
      locale: 'en',
      entry: 'landing',
      source: 'text',
      failureReason: null,
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
    });
    expect(model.findOne).toHaveBeenCalledWith(
      { tokenHash: 'h', status: 'ready' },
      { title: 1, questions: 1 },
    );
    expect(await repository.findReadyByTokenHash('h')).toBeNull();
  });

  it('ignores an invalid id', async () => {
    expect(await repository.markFailed('nope', 'x')).toBe(false);
    expect(model.updateOne).not.toHaveBeenCalled();
  });
});
