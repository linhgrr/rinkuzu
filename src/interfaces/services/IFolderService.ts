import type { DeleteResultDto } from '@/dtos/common';
import type { FolderAssignmentResultDto, FolderListDto, FolderSummaryDto } from '@/dtos/folder';
import type { ServiceResult } from '@/interfaces/services/types';

export interface IFolderService {
  listFolders(ownerId: string): Promise<ServiceResult<FolderListDto>>;

  createFolder(ownerId: string, name: string): Promise<ServiceResult<FolderSummaryDto>>;

  renameFolder(
    folderId: string,
    ownerId: string,
    name: string,
  ): Promise<ServiceResult<FolderSummaryDto>>;

  deleteFolder(folderId: string, ownerId: string): Promise<ServiceResult<DeleteResultDto>>;

  assignQuiz(
    folderId: string | null,
    quizId: string,
    userId: string,
  ): Promise<ServiceResult<FolderAssignmentResultDto>>;
}
