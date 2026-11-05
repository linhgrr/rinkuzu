import type { BookmarkDto, BookmarkListDto } from '@/dtos/bookmark';
import type {
  ProfileBookmarkListViewModel,
  ProfileBookmarkViewModel,
} from '@/features/profile/types/profile-bookmark-view-model';
import { formatCalendarDate } from '@/lib/formatters';
import { copyQuizQuestionContentFields } from '@/lib/quiz/question-fields';

function toProfileBookmarkViewModel(
  bookmark: BookmarkDto,
  locale: string,
): ProfileBookmarkViewModel {
  const { question } = bookmark;
  // Bookmark DTOs use `text`; the shared helper's content field is `question`.
  const { question: text, ...contentFields } = copyQuizQuestionContentFields({
    question: question.text,
    options: question.options,
    questionImage: question.questionImage,
    optionImages: question.optionImages,
  });

  return {
    id: bookmark.id,
    quiz: {
      slug: bookmark.quiz.slug,
      title: bookmark.quiz.title,
      ...(bookmark.quiz.description !== undefined && { description: bookmark.quiz.description }),
    },
    question: {
      text,
      ...contentFields,
      type: question.type,
      ...(question.correctIndex !== undefined && { correctIndex: question.correctIndex }),
      ...(question.correctIndexes !== undefined && { correctIndexes: question.correctIndexes }),
    },
    questionIndex: bookmark.questionIndex,
    createdAt: bookmark.createdAt,
    createdAtLabel: formatCalendarDate(bookmark.createdAt, locale),
    ...(bookmark.updatedAt !== undefined && {
      updatedAt: bookmark.updatedAt,
      updatedAtLabel: formatCalendarDate(bookmark.updatedAt, locale),
    }),
  };
}

export function toProfileBookmarkListViewModel(
  dto: BookmarkListDto,
  locale: string,
): ProfileBookmarkListViewModel {
  return {
    bookmarks: dto.bookmarks.map((bookmark) => toProfileBookmarkViewModel(bookmark, locale)),
    pagination: dto.pagination,
  };
}
