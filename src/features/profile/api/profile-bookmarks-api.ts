import type { BookmarkListDto } from '@/dtos/bookmark';
import { fetchApiData } from '@/lib/api/client';
import { toProfileBookmarkListViewModel } from '@/features/profile/mappers/profile-bookmark.mapper';
import type { ProfileBookmarkListViewModel } from '@/features/profile/types/profile-bookmark-view-model';

export async function fetchProfileBookmarkListViewModel(
  url: string,
): Promise<ProfileBookmarkListViewModel> {
  const data = await fetchApiData<BookmarkListDto>(url);
  return toProfileBookmarkListViewModel(data);
}

export async function deleteProfileBookmark(bookmarkId: string): Promise<void> {
  await fetchApiData<null>(`/api/bookmarks/${bookmarkId}`, {
    method: 'DELETE',
  });
}
