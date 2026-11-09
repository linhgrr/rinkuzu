import { describe, expect, it } from 'vitest';
import type { QuizDraftTransportDto } from '@/dtos/quiz-draft';
import { QuizDraftMapper } from '@/mappers/quiz/QuizDraftMapper';
import { mapDraftStatus } from '@/lib/quiz/draftStatus';

const transportDraft: QuizDraftTransportDto = {
  draft_id: 'draft-1',
  title: 'Generated quiz',
  description: '',
  category_id: 'folder-1',
  prompt: null,
  source_type: 'pdf',
  submit_to_premium: false,
  revision: 2,
  question_count: 2,
  pdf: {
    s3_key: 'users/user-1/source.pdf',
    file_name: 'source.pdf',
    file_size: 1024,
    page_count: 3,
    file_hash: null,
    retained_for_premium: false,
  },
  status: 'completed',
  progress: {
    processed: 3,
    total: 3,
    percent: 100,
  },
  questions: [
    {
      question: 'Pick one',
      type: 'single',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 1,
      correctIndexes: [],
    },
    {
      question: 'Pick many',
      type: 'multiple',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: null,
      correctIndexes: [0, 2],
    },
  ],
  error: null,
  submitted_quiz_id: null,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:01:00Z',
  expires_at: '2026-07-02T00:00:00Z',
};

describe('QuizDraftMapper', () => {
  it('maps transport fields to the frontend draft DTO without leaking snake_case keys', () => {
    const draft = QuizDraftMapper.toViewModel(transportDraft);

    expect(draft).toEqual(
      expect.objectContaining({
        id: 'draft-1',
        folderId: 'folder-1',
        submittedQuizId: null,
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:01:00Z',
        expiresAt: '2026-07-02T00:00:00Z',
        sourceType: 'pdf',
        revision: 2,
        questionCount: 2,
        pdf: expect.objectContaining({
          s3Key: 'users/user-1/source.pdf',
          fileName: 'source.pdf',
          fileSize: 1024,
          pageCount: 3,
          fileHash: null,
          retainedForPremium: false,
        }),
      }),
    );
    expect(draft).not.toHaveProperty('category_id');
    expect(draft).not.toHaveProperty('draft_id');
    expect(draft).not.toHaveProperty('folder_id');
    expect(draft).not.toHaveProperty('created_at');
    expect(draft).not.toHaveProperty('submitted_quiz_id');
  });

  // RIN-1272: the API sends naive UTC timestamps; without a Z the browser reads them as local.
  it('marks naive API timestamps as UTC and keeps offset-bearing ones as sent', () => {
    const draft = QuizDraftMapper.toViewModel({
      ...transportDraft,
      created_at: '2026-11-08T20:03:00',
      updated_at: '2026-11-08T20:06:00.123456',
      expires_at: '2026-11-09T03:06:00+07:00',
    });

    expect(draft.createdAt).toBe('2026-11-08T20:03:00Z');
    expect(draft.updatedAt).toBe('2026-11-08T20:06:00.123456Z');
    expect(draft.expiresAt).toBe('2026-11-09T03:06:00+07:00');
    expect(
      QuizDraftMapper.toViewModel({ ...transportDraft, expires_at: null }).expiresAt,
    ).toBeNull();
  });

  it('maps nullable API answer indexes to the frontend entity shape', () => {
    const draft = QuizDraftMapper.toViewModel(transportDraft);

    expect(draft.questions[0]?.type).toBe('single');
    expect(draft.questions[1]?.type).toBe('multiple');
    if (draft.questions[0]?.type !== 'single' || draft.questions[1]?.type !== 'multiple') {
      throw new Error('Unexpected mapped question types');
    }

    expect(draft.questions[0]?.correctIndex).toBe(1);
    expect(draft.questions[1]?.correctIndexes).toEqual([0, 2]);
  });

  it('maps an optional error_code and defaults it to null when the API omits it', () => {
    expect(QuizDraftMapper.toViewModel(transportDraft).errorCode).toBeNull();
    expect(
      QuizDraftMapper.toViewModel({
        ...transportDraft,
        status: 'failed',
        error_code: 'ocr_request_failed',
      }).errorCode,
    ).toBe('ocr_request_failed');
  });
});

describe('mapDraftStatus', () => {
  it.each([
    ['queued', 'processing'],
    ['drafting', null],
    ['processing', 'processing'],
    ['completed', 'completed'],
    ['failed', 'error'],
    ['cancelled', 'error'],
    ['expired', 'error'],
    ['submitted', null],
  ] as const)('maps %s to %s', (status, expected) => {
    expect(mapDraftStatus(status)).toBe(expected);
  });
});
