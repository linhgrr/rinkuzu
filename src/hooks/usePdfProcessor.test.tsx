/** @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizDraft } from '@/features/quiz/types/quiz-draft';

// The analytics client reads the GA id at import; its dataLayer is the observable sink.
vi.hoisted(() => {
  process.env['NEXT_PUBLIC_GA_ID'] = 'G-TEST123';
});

const { getQuizDraftMock, completeDraftMock, setDraftErrorMock } = vi.hoisted(() => ({
  getQuizDraftMock: vi.fn(),
  completeDraftMock: vi.fn(),
  setDraftErrorMock: vi.fn(),
}));

vi.mock('next-intl', () => ({ useLocale: () => 'en' }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/lib/quiz/draftApi', () => ({ getQuizDraft: getQuizDraftMock }));
vi.mock('@/store/useDraftStore', () => ({
  useDraftStore: () => ({
    updateDraftProgress: vi.fn(),
    completeDraft: completeDraftMock,
    setDraftError: setDraftErrorMock,
  }),
}));

import { usePdfProcessor } from './usePdfProcessor';

function draft(overrides: Partial<QuizDraft> = {}): QuizDraft {
  return {
    id: 'draft-1',
    title: 'Private lecture title',
    status: 'processing',
    questions: [],
    error: null,
    createdAt: '2026-11-02T10:00:00.000Z',
    updatedAt: '2026-11-02T10:01:00.000Z',
    ...overrides,
  } as QuizDraft;
}

function analyticsEvents(name: string) {
  return (window.dataLayer ?? []).filter(
    (entry) => Array.isArray(entry) && entry[0] === 'event' && entry[1] === name,
  ) as [string, string, Record<string, unknown>][];
}

describe('usePdfProcessor terminal analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('rinkuzu_analytics_consent_v1', 'granted');
    window.dataLayer = [];
  });

  it('emits one pipeline_failed when a polled draft fails, even if it is resumed again', async () => {
    getQuizDraftMock.mockResolvedValue(
      draft({ status: 'failed', error: 'OCR API request failed for all configured keys.' }),
    );
    const { result } = renderHook(() => usePdfProcessor());

    await act(() => result.current.startProcessing('draft-1', 'Private lecture title'));
    await act(() => result.current.resumeProcessing('draft-1'));

    expect(setDraftErrorMock).toHaveBeenCalledTimes(1);
    const failed = analyticsEvents('pipeline_failed');
    expect(failed).toHaveLength(1);
    expect(failed[0]?.[2]).toMatchObject({
      path: 'quiz_draft',
      error_code: 'ocr_failed',
      duration_ms: 60_000,
    });
    expect(JSON.stringify(failed[0]?.[2])).not.toMatch(/Private lecture|OCR API/);
  });

  it('emits one pipeline_completed for a draft that finished while the tab was away', async () => {
    getQuizDraftMock.mockResolvedValue(draft({ status: 'completed' }));
    const { result } = renderHook(() => usePdfProcessor());

    await act(() => result.current.resumeProcessing('draft-1'));
    await act(() => result.current.resumeProcessing('draft-1'));

    expect(analyticsEvents('pipeline_completed')).toHaveLength(1);
    expect(analyticsEvents('pipeline_failed')).toHaveLength(0);
  });
});
