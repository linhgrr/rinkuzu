import { afterEach, describe, expect, it, vi } from 'vitest';

const { fetchApiDataMock, fetchAttemptDetailViewModelMock } = vi.hoisted(() => ({
  fetchApiDataMock: vi.fn(),
  fetchAttemptDetailViewModelMock: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  fetchApiData: fetchApiDataMock,
}));

vi.mock('@/features/profile/api/attempt-detail-api', () => ({
  fetchAttemptDetailViewModel: fetchAttemptDetailViewModelMock,
}));

import { fetchQuizResultPageData } from './quiz-result-page-api';

const result = {
  id: 'attempt-1',
  score: 90,
  quiz: {
    title: 'Algebra',
    slug: 'algebra',
    description: 'desc',
    questions: [{ question: '1+1?', options: ['1', '2'], type: 'single' as const }],
  },
};

describe('fetchQuizResultPageData', () => {
  afterEach(() => {
    fetchApiDataMock.mockReset();
    fetchAttemptDetailViewModelMock.mockReset();
  });

  it('loads attempt detail and bookmarks for authenticated users', async () => {
    fetchAttemptDetailViewModelMock.mockResolvedValueOnce(result);
    fetchApiDataMock.mockResolvedValueOnce({
      bookmarks: [{ id: 'bm-1', questionIndex: 0 }],
    });

    await expect(fetchQuizResultPageData('attempt-1', 'en')).resolves.toEqual({
      result,
      bookmarks: {
        bookmarkedQuestions: new Set([0]),
        bookmarkIdsByQuestion: { 0: 'bm-1' },
      },
    });
    expect(fetchAttemptDetailViewModelMock).toHaveBeenCalledWith('attempt-1', 'en', undefined);
    expect(fetchApiDataMock).toHaveBeenCalledWith('/api/bookmarks?quizSlug=algebra&limit=1');
  });

  it('threads guest email for attempt detail and skips protected bookmark fetch', async () => {
    fetchAttemptDetailViewModelMock.mockResolvedValueOnce(result);

    await expect(
      fetchQuizResultPageData('attempt-1', 'en', { userEmail: 'guest@example.com' }),
    ).resolves.toEqual({
      result,
      bookmarks: {
        bookmarkedQuestions: new Set(),
        bookmarkIdsByQuestion: {},
      },
    });
    expect(fetchAttemptDetailViewModelMock).toHaveBeenCalledWith('attempt-1', 'en', {
      userEmail: 'guest@example.com',
    });
    expect(fetchApiDataMock).not.toHaveBeenCalled();
  });
});
