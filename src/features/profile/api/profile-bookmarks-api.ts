import type { BookmarkListDto, BookmarkQuizListDto } from '@/dtos/bookmark';
import type { DeleteResultDto } from '@/dtos/common';
import { fetchApiData } from '@/lib/api/client';
import {
  toProfileBookmarkListViewModel,
  toProfileBookmarkQuizListViewModel,
} from '@/features/profile/mappers/profile-bookmark.mapper';
import type {
  ProfileBookmarkListViewModel,
  ProfileBookmarkQuizListViewModel,
} from '@/features/profile/types/profile-bookmark-view-model';

export async function fetchProfileBookmarkListViewModel(
  url: string,
  locale: string,
): Promise<ProfileBookmarkListViewModel> {
  const data = await fetchApiData<BookmarkListDto>(url);
  return toProfileBookmarkListViewModel(data, locale);
}

/** GET /api/bookmarks/quizzes: the quizzes the learner has bookmarks in (RIN-1199). */
export async function fetchProfileBookmarkQuizzes(): Promise<ProfileBookmarkQuizListViewModel> {
  const data = await fetchApiData<BookmarkQuizListDto>('/api/bookmarks/quizzes');
  return toProfileBookmarkQuizListViewModel(data);
}

export async function deleteProfileBookmark(bookmarkId: string): Promise<DeleteResultDto> {
  return fetchApiData<DeleteResultDto>(`/api/bookmarks/${bookmarkId}`, {
    method: 'DELETE',
  });
}
