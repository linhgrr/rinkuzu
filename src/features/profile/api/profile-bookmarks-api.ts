import type { BookmarkListDto } from '@/dtos/bookmark';
import type { DeleteResultDto } from '@/dtos/common';
import { fetchApiData } from '@/lib/api/client';
import { toProfileBookmarkListViewModel } from '@/features/profile/mappers/profile-bookmark.mapper';
import type { ProfileBookmarkListViewModel } from '@/features/profile/types/profile-bookmark-view-model';

export async function fetchProfileBookmarkListViewModel(
  url: string,
  locale: string,
): Promise<ProfileBookmarkListViewModel> {
  const data = await fetchApiData<BookmarkListDto>(url);
  return toProfileBookmarkListViewModel(data, locale);
}

export async function deleteProfileBookmark(bookmarkId: string): Promise<DeleteResultDto> {
  return fetchApiData<DeleteResultDto>(`/api/bookmarks/${bookmarkId}`, {
    method: 'DELETE',
  });
}
