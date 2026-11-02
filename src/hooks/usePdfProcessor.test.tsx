/** @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizDraft } from '@/features/quiz/types/quiz-draft';
import enDraft from '../../messages/en/draft.json';
import viDraft from '../../messages/vi/draft.json';
import { usePdfProcessor } from './usePdfProcessor';

// RIN-565: the draft failure toast used to be hard-coded Vietnamese, so /en
// learners whose PDF failed read "Lỗi xử lý ...".

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

const messagesByLocale = { en: { draft: enDraft }, vi: { draft: viDraft } };

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

  it('localises the title when the status request itself fails', async () => {
    mocks.getQuizDraft.mockRejectedValue(new Error('Draft not found'));
    const { result } = renderProcessor('en');

    await act(() => result.current.startProcessing('draft-1', 'Photosynthesis'));

    expect(mocks.toastError).toHaveBeenCalledWith('Could not process "Photosynthesis"', {
      description: 'Draft not found',
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
