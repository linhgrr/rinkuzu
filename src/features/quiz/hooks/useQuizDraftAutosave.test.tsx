// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuizDraftAutosave } from '@/features/quiz/hooks/useQuizDraftAutosave';
import { ApiResponseError } from '@/lib/api/client';
import { patchQuizDraft } from '@/lib/quiz/draftApi';
import type { QuizDraft } from '@/features/quiz/types/quiz-draft';

vi.mock('@/lib/quiz/draftApi', () => ({ patchQuizDraft: vi.fn() }));

const patchQuizDraftMock = vi.mocked(patchQuizDraft);
const payload = {
  title: 'Draft title',
  description: '',
  selectedFolderId: null,
  isPrivate: false,
  questions: [
    {
      type: 'single' as const,
      question: 'Question?',
      options: ['A', 'B'],
      correctIndex: 0,
    },
  ],
};

describe('useQuizDraftAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    patchQuizDraftMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists recovery immediately and saves to the server after the debounce', async () => {
    patchQuizDraftMock.mockResolvedValue({ revision: 1 } as QuizDraft);
    const { result } = renderHook(() => useQuizDraftAutosave('draft-1', 0));

    act(() => result.current.queueSave(payload));
    expect(window.localStorage.getItem('quiz-draft-recovery:draft-1')).toContain('Draft title');

    await act(async () => vi.advanceTimersByTimeAsync(1000));

    expect(patchQuizDraftMock).toHaveBeenCalledWith(
      'draft-1',
      expect.objectContaining({ expectedRevision: 0, title: 'Draft title' }),
    );
    expect(result.current.status).toBe('saved');
    expect(window.localStorage.getItem('quiz-draft-recovery:draft-1')).toBeNull();
  });

  it('keeps local recovery and exposes a conflict when the revision is stale', async () => {
    patchQuizDraftMock.mockRejectedValue(
      new ApiResponseError({ message: 'Conflict', status: 409, payload: null }),
    );
    const { result } = renderHook(() => useQuizDraftAutosave('draft-2', 3));

    act(() => result.current.queueSave(payload));
    await act(async () => vi.advanceTimersByTimeAsync(1000));

    expect(result.current.status).toBe('conflict');
    expect(window.localStorage.getItem('quiz-draft-recovery:draft-2')).toContain('Draft title');
  });
});
