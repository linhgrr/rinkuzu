import type { BookmarkDto, BookmarkListDto } from '@/dtos/bookmark';
import type { DeleteResultDto } from '@/dtos/common';
import { fetchAttemptDetailViewModel } from '@/features/profile/api/attempt-detail-api';
import type {
  CreateQuizResultBookmarkInput,
  QuizResultBookmarkLookup,
  QuizResultBookmarkMutationViewModel,
  QuizResultPageDataViewModel,
  QuizResultViewModel,
} from '@/features/quiz/types/quiz-result-page-view-model';
import { fetchApiData } from '@/lib/api/client';

const EMPTY_BOOKMARK_LOOKUP: QuizResultBookmarkLookup = {
  bookmarkedQuestions: new Set<number>(),
  bookmarkIdsByQuestion: {},
};

async function fetchBookmarkLookup(result: QuizResultViewModel): Promise<QuizResultBookmarkLookup> {
  const quizQuestionSpan = result.questionIndices
    ? Math.max(-1, ...result.questionIndices) + 1
    : result.quiz.questions.length;
  const lookupLimit = Math.min(Math.max(quizQuestionSpan, 1), 100);
  const params = new URLSearchParams({
    quizSlug: result.quiz.slug,
    limit: String(lookupLimit),
  });
  const data = await fetchApiData<BookmarkListDto>(`/api/bookmarks?${params.toString()}`);

  const bookmarkedQuestions = new Set<number>();
  const bookmarkIdsByQuestion: Record<number, string> = {};
  // Bookmarks store the quiz question index; a retry attempt shows a subset, so translate
  // to the position on this result page and skip bookmarks of questions not shown.
  const positionByQuizIndex = result.questionIndices
    ? new Map(result.questionIndices.map((quizIndex, position) => [quizIndex, position]))
    : null;

  data.bookmarks.forEach((bookmark) => {
    const position = positionByQuizIndex
      ? positionByQuizIndex.get(bookmark.questionIndex)
      : bookmark.questionIndex;
    if (position === undefined) return;
    bookmarkedQuestions.add(position);
    bookmarkIdsByQuestion[position] = bookmark.id;
  });

  return {
    bookmarkedQuestions,
    bookmarkIdsByQuestion,
  };
}

export type FetchQuizResultPageDataOptions = {
  userEmail?: string;
};

export async function fetchQuizResultPageData(
  attemptId: string,
  locale: string,
  options?: FetchQuizResultPageDataOptions,
): Promise<QuizResultPageDataViewModel> {
  const result = await fetchAttemptDetailViewModel(
    attemptId,
    locale,
    options?.userEmail ? { userEmail: options.userEmail } : undefined,
  );

  // Bookmarks require an authenticated session. Guests identify via userEmail
  // and must not hit the protected bookmark list endpoint.
  if (options?.userEmail) {
    return { result, bookmarks: EMPTY_BOOKMARK_LOOKUP };
  }

  if (result.historyStatus === 'content_locked') {
    return { result, bookmarks: EMPTY_BOOKMARK_LOOKUP };
  }

  const bookmarks = await fetchBookmarkLookup(result);
  return { result, bookmarks };
}

export async function deleteQuizResultBookmark(bookmarkId: string): Promise<DeleteResultDto> {
  return fetchApiData<DeleteResultDto>(`/api/bookmarks/${bookmarkId}`, { method: 'DELETE' });
}

export async function createQuizResultBookmark(
  input: CreateQuizResultBookmarkInput,
): Promise<QuizResultBookmarkMutationViewModel> {
  const created = await fetchApiData<BookmarkDto>('/api/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quiz: {
        title: input.result.quiz.title,
        slug: input.result.quiz.slug,
        description: input.result.quiz.description,
      },
      question: {
        text: input.question.question,
        options: input.question.options,
        type: input.question.type,
        correctIndex: input.question.correctIndex,
        correctIndexes: input.question.correctIndexes,
        questionImage: input.question.questionImage,
        optionImages: input.question.optionImages,
      },
      questionIndex: input.result.questionIndices?.[input.questionIndex] ?? input.questionIndex,
    }),
  });

  return { id: created.id };
}
