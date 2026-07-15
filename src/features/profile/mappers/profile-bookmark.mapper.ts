import type { BookmarkDto, BookmarkListDto } from '@/dtos/bookmark';
import type {
  ProfileBookmarkListViewModel,
  ProfileBookmarkViewModel,
} from '@/features/profile/types/profile-bookmark-view-model';
import { formatDate } from '@/lib/formatters';

export function toProfileBookmarkViewModel(bookmark: BookmarkDto): ProfileBookmarkViewModel {
  return {
    id: bookmark.id,
    quiz: {
      slug: bookmark.quiz.slug,
      title: bookmark.quiz.title,
      ...(bookmark.quiz.description !== undefined && {
        description: bookmark.quiz.description,
      }),
    },
    question: {
      text: bookmark.question.text,
      options: bookmark.question.options,
      type: bookmark.question.type,
      ...(bookmark.question.correctIndex !== undefined && {
        correctIndex: bookmark.question.correctIndex,
      }),
      ...(bookmark.question.correctIndexes !== undefined && {
        correctIndexes: bookmark.question.correctIndexes,
      }),
      ...(bookmark.question.questionImage !== undefined && {
        questionImage: bookmark.question.questionImage,
      }),
      ...(bookmark.question.optionImages !== undefined && {
        optionImages: bookmark.question.optionImages,
      }),
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
