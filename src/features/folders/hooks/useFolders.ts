'use client';

import useSWR from 'swr';
import { fetchApiData } from '@/lib/api/client';
import type { FolderListData } from '../types';

export function useFolders() {
  const result = useSWR<FolderListData>('/api/folders', fetchApiData);

  return {
    ...result,
    folders: result.data?.folders ?? [],
    unfiledCount: result.data?.unfiledCount ?? 0,
  };
}
