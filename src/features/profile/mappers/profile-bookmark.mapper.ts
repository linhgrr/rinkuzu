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
      description: bookmark.quiz.description,
    },
    question: {
      text: bookmark.question.text,
      options: bookmark.question.options,
      type: bookmark.question.type,
      correctIndex: bookmark.question.correctIndex,
      correctIndexes: bookmark.question.correctIndexes,
      questionImage: bookmark.question.questionImage,
      optionImages: bookmark.question.optionImages,
    },
    questionIndex: bookmark.questionIndex,
    createdAt: bookmark.createdAt,
    createdAtLabel: formatDate(bookmark.createdAt),
    updatedAt: bookmark.updatedAt,
    updatedAtLabel: bookmark.updatedAt ? formatDate(bookmark.updatedAt) : undefined,
  };
}

export function toProfileBookmarkListViewModel(dto: BookmarkListDto): ProfileBookmarkListViewModel {
  return {
    bookmarks: dto.bookmarks.map(toProfileBookmarkViewModel),
    pagination: dto.pagination,
  };
}
