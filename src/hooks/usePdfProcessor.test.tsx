/** @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizDraft } from '@/features/quiz/types/quiz-draft';
import enDraft from '../../messages/en/draft.json';
import enErrors from '../../messages/en/errors.json';
import viDraft from '../../messages/vi/draft.json';
import viErrors from '../../messages/vi/errors.json';
import { ApiResponseError } from '@/lib/api/client';
import { usePdfProcessor } from './usePdfProcessor';

// RIN-565: the draft failure toast used to be hard-coded Vietnamese, so /en
// learners whose PDF failed read "Lỗi xử lý ...".

// The analytics client reads the GA id at import; its dataLayer is the observable sink.
vi.hoisted(() => {
  process.env['NEXT_PUBLIC_GA_ID'] = 'G-TEST123';
});

const mocks = vi.hoisted(() => ({
  getQuizDraft: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  setDraftError: vi.fn(),
  completeDraft: vi.fn(),
  updateDraftProgress: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

vi.mock('@/lib/quiz/draftApi', () => ({
  getQuizDraft: mocks.getQuizDraft,
}));

vi.mock('@/store/useDraftStore', () => ({
  useDraftStore: () => ({
    setDraftError: mocks.setDraftError,
    completeDraft: mocks.completeDraft,
    updateDraftProgress: mocks.updateDraftProgress,
  }),
}));

const messagesByLocale = {
  en: { draft: enDraft, errors: enErrors },
  vi: { draft: viDraft, errors: viErrors },
};

function renderProcessor(locale: 'en' | 'vi') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale={locale} messages={messagesByLocale[locale]}>
      {children}
    </NextIntlClientProvider>
  );
  return renderHook(() => usePdfProcessor(), { wrapper });
}

function draftSnapshot(overrides: Partial<QuizDraft>): QuizDraft {
  return {
    id: 'draft-1',
    title: 'Photosynthesis',
    description: '',
    folderId: 'folder-1',
    prompt: null,
    sourceType: 'pdf',
    submitToPremium: false,
    revision: 1,
    questionCount: 0,
    pdf: {
      s3Key: 'users/user-1/source.pdf',
      fileName: 'source.pdf',
      fileSize: 1024,
      pageCount: 2,
      fileHash: null,
      retainedForPremium: false,
    },
    status: 'failed',
    progress: { processed: 0, total: 3, percent: 0 },
    questions: [],
    error: 'OCR request failed',
    errorCode: null,
    submittedQuizId: null,
    createdAt: '2026-11-02T00:00:00Z',
    updatedAt: '2026-11-02T00:00:10Z',
    expiresAt: '2026-11-09T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.dataLayer = [];
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('usePdfProcessor failure toast', () => {
  it.each([
    {
      locale: 'en' as const,
      title: 'Could not process "Photosynthesis"',
      description: 'Please try again later.',
      storeError: 'Extraction failed or the draft has expired',
    },
    {
      locale: 'vi' as const,
      title: 'Lỗi xử lý "Photosynthesis"',
      description: 'Vui lòng thử lại sau',
      storeError: 'Trích xuất thất bại hoặc bản nháp đã hết hạn',
    },
  ])('shows the generic failure in $locale', async ({ locale, title, description, storeError }) => {
    mocks.getQuizDraft.mockResolvedValue(draftSnapshot({ status: 'failed' }));
    const { result } = renderProcessor(locale);

    await act(() => result.current.startProcessing('draft-1', 'Photosynthesis'));

    expect(mocks.toastError).toHaveBeenCalledWith(title, { description });
    expect(mocks.setDraftError).toHaveBeenCalledWith('draft-1', storeError);
  });

  it.each([
    {
      locale: 'en' as const,
      description:
        'Text recognition is temporarily unavailable. Trying again in a few minutes usually works.',
    },
    {
      locale: 'vi' as const,
      description:
        'Tính năng nhận dạng văn bản tạm thời gián đoạn. Thử lại sau vài phút thường sẽ thành công.',
    },
  ])(
    'says retrying later helps for a retryable error in $locale',
    async ({ locale, description }) => {
      mocks.getQuizDraft.mockResolvedValue(
        draftSnapshot({ status: 'failed', errorCode: 'ocr_request_failed' }),
      );
      const { result } = renderProcessor(locale);

      await act(() => result.current.startProcessing('draft-1', 'Photosynthesis'));

      expect(mocks.toastError).toHaveBeenCalledWith(expect.any(String), { description });
      expect(mocks.setDraftError).toHaveBeenCalledWith('draft-1', description);
    },
  );

  it('keeps the generic text for a non-retryable error code', async () => {
    mocks.getQuizDraft.mockResolvedValue(
      draftSnapshot({ status: 'failed', errorCode: 'pipeline_failed' }),
    );
    const { result } = renderProcessor('en');

    await act(() => result.current.startProcessing('draft-1', 'Photosynthesis'));

    expect(mocks.toastError).toHaveBeenCalledWith('Could not process "Photosynthesis"', {
      description: 'Please try again later.',
    });
  });

  // RIN-754: this used to expect the error's own text ('Draft not found') in the toast.
  it('localises the title and body when the status request itself fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.getQuizDraft.mockRejectedValue(new Error('Draft not found'));
    const { result } = renderProcessor('en');

    await act(() => result.current.startProcessing('draft-1', 'Photosynthesis'));

    expect(mocks.toastError).toHaveBeenCalledWith('Could not process "Photosynthesis"', {
      description: enDraft.statusFetchFailed,
    });
  });

  it('uses the API error copy, not the server text, for a coded status failure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.getQuizDraft.mockRejectedValue(
      new ApiResponseError({
        message: 'QuizDraft 66f0 not found in collection quiz_drafts',
        status: 404,
        payload: null,
        code: 'not_found',
      }),
    );
    const { result } = renderProcessor('en');

    await act(() => result.current.startProcessing('draft-1', 'Photosynthesis'));

    expect(mocks.toastError).toHaveBeenCalledWith('Could not process "Photosynthesis"', {
      description: enErrors.api.notFound,
    });
  });

  it('localises the timeout toast', async () => {
    vi.useFakeTimers();
    mocks.getQuizDraft.mockResolvedValue(draftSnapshot({ status: 'processing', error: null }));
    const { result } = renderProcessor('en');

    await act(async () => {
      const run = result.current.startProcessing('draft-1', 'Photosynthesis');
      await vi.runAllTimersAsync();
      await run;
    });

    expect(mocks.setDraftError).toHaveBeenCalledWith('draft-1', 'PDF processing timed out');
    expect(mocks.toastError).toHaveBeenCalledWith(
      'Processing "Photosynthesis" is taking too long',
      {
        description: 'Please try again later.',
      },
    );
  });
});

describe('usePdfProcessor ready toast', () => {
  it.each([
    {
      locale: 'en' as const,
      title: '"Photosynthesis" is ready!',
      description: '2 questions extracted',
      label: 'View',
    },
    {
      locale: 'vi' as const,
      title: '"Photosynthesis" đã sẵn sàng!',
      description: '2 câu hỏi được trích xuất',
      label: 'Xem',
    },
  ])('is localised in $locale', async ({ locale, title, description, label }) => {
    const questions = [
      { question: 'Q1', type: 'single' as const, options: ['A', 'B'], correctIndex: 0 },
      { question: 'Q2', type: 'single' as const, options: ['A', 'B'], correctIndex: 1 },
    ];
    mocks.getQuizDraft.mockResolvedValue(
      draftSnapshot({ status: 'completed', error: null, questions, questionCount: 2 }),
    );
    const { result } = renderProcessor(locale);

    await act(() => result.current.startProcessing('draft-1', 'Photosynthesis'));

    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      title,
      expect.objectContaining({
        description,
        action: expect.objectContaining({ label }),
      }),
    );
  });
});

function analyticsEvents(name: string) {
  return (window.dataLayer ?? []).filter(
    (entry) => Array.isArray(entry) && entry[0] === 'event' && entry[1] === name,
  ) as [string, string, Record<string, unknown>][];
}

describe('usePdfProcessor terminal analytics', () => {
  beforeEach(() => {
    window.localStorage.setItem('rinkuzu_analytics_consent_v1', 'granted');
  });

  it('emits one pipeline_failed when a polled draft fails, even if it is resumed again', async () => {
    mocks.getQuizDraft.mockResolvedValue(
      draftSnapshot({
        status: 'failed',
        title: 'Private lecture title',
        error: 'OCR API request failed for all configured keys.',
      }),
    );
    const { result } = renderProcessor('en');

    await act(() => result.current.startProcessing('draft-1', 'Private lecture title'));
    await act(() => result.current.resumeProcessing('draft-1'));

    expect(mocks.setDraftError).toHaveBeenCalledTimes(1);
    const failed = analyticsEvents('pipeline_failed');
    expect(failed).toHaveLength(1);
    expect(failed[0]?.[2]).toMatchObject({
      path: 'quiz_draft',
      error_code: 'ocr_failed',
      duration_ms: 10_000,
    });
    expect(JSON.stringify(failed[0]?.[2])).not.toMatch(/Private lecture|OCR API|source\.pdf/);
  });

  it('emits one pipeline_completed for a draft that finished while the tab was away', async () => {
    mocks.getQuizDraft.mockResolvedValue(draftSnapshot({ status: 'completed', error: null }));
    const { result } = renderProcessor('en');

    await act(() => result.current.resumeProcessing('draft-1'));
    await act(() => result.current.resumeProcessing('draft-1'));

    expect(analyticsEvents('pipeline_completed')).toHaveLength(1);
    expect(analyticsEvents('pipeline_failed')).toHaveLength(0);
  });
});
