import type { IFolderRepository } from '@/interfaces/repositories/IFolderRepository';
import type { IFolderService } from '@/interfaces/services/IFolderService';
import type { ServiceResult } from '@/interfaces/services/types';
import type { DeleteResultDto } from '@/dtos/common';
import type { FolderAssignmentResultDto, FolderListDto, FolderSummaryDto } from '@/dtos/folder';
import { FolderNameConflictError } from '@/entities/Folder';
import { DeleteResultDtoMapper } from '@/mappers/common/DeleteResultDtoMapper';
import { FolderDtoMapper } from '@/mappers/folder/FolderDtoMapper';
import { logger } from '@/lib/logger';

export class FolderService implements IFolderService {
  constructor(private readonly folderRepository: IFolderRepository) {}

  async listFolders(ownerId: string): Promise<ServiceResult<FolderListDto>> {
    try {
      const result = await this.folderRepository.listOverviewByOwner(ownerId);
      return {
        success: true,
        data: FolderDtoMapper.toList(result.folders, result.unfiledCount),
      };
    } catch (error) {
      logger.error({ error, ownerId }, 'List folders error');
      return {
        success: false,
        error: 'Failed to get folders',
        statusCode: 500,
      };
    }
  }

  async createFolder(ownerId: string, name: string): Promise<ServiceResult<FolderSummaryDto>> {
    try {
      const folder = await this.folderRepository.create({ ownerId, name });
      return {
        success: true,
        data: FolderDtoMapper.toSummary(folder),
      };
    } catch (error) {
      if (error instanceof FolderNameConflictError) {
        return {
          success: false,
          error: error.message,
          statusCode: 409,
        };
      }
      logger.error({ error, ownerId }, 'Create folder error');
      return {
        success: false,
        error: 'Failed to create folder',
        statusCode: 500,
      };
    }
  }

  async renameFolder(
    folderId: string,
    ownerId: string,
    name: string,
  ): Promise<ServiceResult<FolderSummaryDto>> {
    try {
      const folder = await this.folderRepository.rename(folderId, ownerId, name);
      if (!folder) {
        return {
          success: false,
          error: 'Folder not found',
          statusCode: 404,
        };
      }
      return {
        success: true,
        data: FolderDtoMapper.toSummary(folder),
      };
    } catch (error) {
      if (error instanceof FolderNameConflictError) {
        return {
          success: false,
          error: error.message,
          statusCode: 409,
        };
      }
      logger.error({ error, folderId, ownerId }, 'Rename folder error');
      return {
        success: false,
        error: 'Failed to rename folder',
        statusCode: 500,
      };
    }
  }

  async deleteFolder(folderId: string, ownerId: string): Promise<ServiceResult<DeleteResultDto>> {
    try {
      const deleted = await this.folderRepository.deleteOwned(folderId, ownerId);
      if (!deleted) {
        return {
          success: false,
          error: 'Folder not found',
          statusCode: 404,
        };
      }
      return { success: true, data: DeleteResultDtoMapper.toDto(folderId) };
    } catch (error) {
      logger.error({ error, folderId, ownerId }, 'Delete folder error');
      return {
        success: false,
        error: 'Failed to delete folder',
        statusCode: 500,
      };
    }
  }

  async assignQuiz(
    folderId: string | null,
    quizId: string,
    userId: string,
  ): Promise<ServiceResult<FolderAssignmentResultDto>> {
    try {
      const [quizAccess, folder] = await Promise.all([
        this.folderRepository.findQuizAccess(userId, quizId),
        folderId ? this.folderRepository.findOwnedById(folderId, userId) : Promise.resolve(null),
      ]);

      if (!quizAccess) {
        return {
          success: false,
          error: 'Quiz not found',
          statusCode: 404,
        };
      }
      if (folderId && !folder) {
        return {
          success: false,
          error: 'Folder not found',
          statusCode: 404,
        };
      }

      const ownedByUser = quizAccess.quizOwnerId === userId;
      if (!ownedByUser && !quizAccess.hasAttempt && !quizAccess.hasProgress) {
        return {
          success: false,
          error: 'Only owned or completed quizzes can be added',
          statusCode: 403,
        };
      }

      await this.folderRepository.saveQuizPlacement(
        userId,
        quizId,
        quizAccess.quizOwnerId,
        folderId,
      );
      return { success: true, data: FolderDtoMapper.toAssignmentResult(quizId, folderId) };
    } catch (error) {
      logger.error({ error, folderId, quizId, userId }, 'Assign quiz to folder error');
      return {
        success: false,
        error: 'Failed to add quiz to folder',
        statusCode: 500,
      };
    }
  }
}
