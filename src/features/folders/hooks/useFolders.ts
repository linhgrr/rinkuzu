'use client';

import useSWR from 'swr';
import { fetchFoldersViewModel } from '@/features/folders/api/folders-api';

export function useFolders() {
  const result = useSWR('/api/folders', fetchFoldersViewModel);

  return {
    ...result,
    folders: result.data?.folders ?? [],
    unfiledCount: result.data?.unfiledCount ?? 0,
  };
}
