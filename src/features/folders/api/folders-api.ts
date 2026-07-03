import type { DeleteResultDto } from '@/dtos/common';
import type { FolderAssignmentResultDto, FolderListDto, FolderSummaryDto } from '@/dtos/folder';
import type { LibraryListDto } from '@/dtos/review';
import {
  toFolderLibraryQuizViewModels,
  toFolderListViewModel,
  toFolderSummaryViewModel,
} from '@/features/folders/mappers/folder.mapper';
import type {
  FolderLibraryQuizViewModel,
  FolderListViewModel,
  FolderSummaryViewModel,
} from '@/features/folders/types/folder-view-model';
import { fetchApiData, fetchApiResponse } from '@/lib/api/client';
import { routePathSegment } from '@/lib/routing/routeParams';
import { UNFILED_FOLDER_TARGET } from '@/shared/constants/folder';

export async function fetchFoldersViewModel(): Promise<FolderListViewModel> {
  const dto = await fetchApiData<FolderListDto>('/api/folders');
  return toFolderListViewModel(dto);
}

export async function createFolderViewModel(name: string): Promise<FolderSummaryViewModel> {
  const dto = await fetchApiData<FolderSummaryDto>('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return toFolderSummaryViewModel(dto);
}

export async function renameFolderViewModel(
  folderId: string,
  name: string,
): Promise<FolderSummaryViewModel> {
  const encodedFolderId = routePathSegment(folderId);
  const response = await fetchApiResponse<FolderSummaryDto>(`/api/folders/${encodedFolderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return toFolderSummaryViewModel(response.data);
}

export async function deleteFolderViewModel(folderId: string): Promise<DeleteResultDto> {
  const encodedFolderId = routePathSegment(folderId);
  const response = await fetchApiResponse<DeleteResultDto>(`/api/folders/${encodedFolderId}`, {
    method: 'DELETE',
  });
  return response.data;
}

export async function fetchFolderLibraryQuizViewModels(
  folderId?: string,
): Promise<FolderLibraryQuizViewModel[]> {
  const params = new URLSearchParams({ limit: '100' });
  if (folderId) {
    params.set('folder', folderId);
  }
  const dto = await fetchApiData<LibraryListDto>(`/api/library?${params}`);
  return toFolderLibraryQuizViewModels(dto);
}

export async function fetchFolderDetailQuizViewModels(
  folderId: string,
  isUnfiled: boolean,
): Promise<FolderLibraryQuizViewModel[]> {
  return fetchFolderLibraryQuizViewModels(isUnfiled ? UNFILED_FOLDER_TARGET : folderId);
}

export async function addQuizToFolderViewModel(
  folderId: string,
  quizId: string,
): Promise<FolderAssignmentResultDto> {
  const encodedFolderId = routePathSegment(folderId);
  const response = await fetchApiResponse<FolderAssignmentResultDto>(
    `/api/folders/${encodedFolderId}/quizzes`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId }),
    },
  );
  return response.data;
}
