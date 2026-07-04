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

async function fetchBookmarkLookup(result: QuizResultViewModel): Promise<QuizResultBookmarkLookup> {
  const lookupLimit = Math.min(Math.max(result.quiz.questions.length, 1), 100);
  const params = new URLSearchParams({
    quizSlug: result.quiz.slug,
    limit: String(lookupLimit),
  });
  const data = await fetchApiData<BookmarkListDto>(`/api/bookmarks?${params.toString()}`);

  const bookmarkedQuestions = new Set<number>();
  const bookmarkIdsByQuestion: Record<number, string> = {};

  data.bookmarks.forEach((bookmark) => {
    bookmarkedQuestions.add(bookmark.questionIndex);
    bookmarkIdsByQuestion[bookmark.questionIndex] = bookmark.id;
  });

  return {
    bookmarkedQuestions,
    bookmarkIdsByQuestion,
  };
}

export async function fetchQuizResultPageData(
  attemptId: string,
  locale: string,
): Promise<QuizResultPageDataViewModel> {
  const result = await fetchAttemptDetailViewModel(attemptId, locale);
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
      questionIndex: input.questionIndex,
    }),
  });

  return { id: created.id };
}
