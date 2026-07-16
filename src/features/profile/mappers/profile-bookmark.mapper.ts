import type { BookmarkDto, BookmarkListDto } from '@/dtos/bookmark';
import type {
  ProfileBookmarkListViewModel,
  ProfileBookmarkViewModel,
} from '@/features/profile/types/profile-bookmark-view-model';
import { formatDate } from '@/lib/formatters';

export function toProfileBookmarkViewModel(bookmark: BookmarkDto): ProfileBookmarkViewModel {
  return {
    id: bookmark.id,
    quiz: bookmark.quiz,
    question: bookmark.question,
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
