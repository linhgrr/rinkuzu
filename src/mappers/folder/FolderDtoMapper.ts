import type { Folder, FolderOverview } from '@/entities/Folder';
import type { FolderAssignmentResultDto, FolderListDto, FolderSummaryDto } from '@/dtos/folder';
import { serializeDate } from '@/lib/date-serialization';

export class FolderDtoMapper {
  static toList(folders: FolderOverview[], unfiledCount: number): FolderListDto {
    return {
      folders: folders.map((folder) => FolderDtoMapper.toSummary(folder)),
      unfiledCount,
    };
  }

  static toSummary(folder: Folder | FolderOverview, quizCount = 0): FolderSummaryDto {
    return {
      id: folder.id,
      name: folder.name,
      quizCount: 'quizCount' in folder ? folder.quizCount : quizCount,
      createdAt: serializeDate(folder.createdAt, 'folder.createdAt'),
      updatedAt: serializeDate(folder.updatedAt, 'folder.updatedAt'),
    };
  }

  static toAssignmentResult(quizId: string, folderId: string | null): FolderAssignmentResultDto {
    return {
      quizId,
      folderId,
      assigned: true,
    };
  }
}
