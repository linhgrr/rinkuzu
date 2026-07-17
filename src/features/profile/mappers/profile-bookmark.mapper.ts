import type { BookmarkDto, BookmarkListDto } from '@/dtos/bookmark';
import type {
  ProfileBookmarkListViewModel,
  ProfileBookmarkViewModel,
} from '@/features/profile/types/profile-bookmark-view-model';
import { formatDate } from '@/lib/formatters';
import { copyQuizQuestionContentFields } from '@/lib/quiz/question-fields';

function toProfileBookmarkViewModel(bookmark: BookmarkDto): ProfileBookmarkViewModel {
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
    createdAtLabel: formatDate(bookmark.createdAt),
    ...(bookmark.updatedAt !== undefined && {
      updatedAt: bookmark.updatedAt,
      updatedAtLabel: formatDate(bookmark.updatedAt),
    }),
  };
}

export function toProfileBookmarkListViewModel(dto: BookmarkListDto): ProfileBookmarkListViewModel {
  return {
    bookmarks: dto.bookmarks.map(toProfileBookmarkViewModel),
    pagination: dto.pagination,
  };
}
