import type { Folder, FolderOverview } from '@/entities/Folder';
import type { FolderSummaryDto } from '@/dtos/folder';

export class FolderDtoMapper {
  static toSummary(folder: Folder | FolderOverview, quizCount = 0): FolderSummaryDto {
    return {
      id: folder.id,
      name: folder.name,
      quizCount: 'quizCount' in folder ? folder.quizCount : quizCount,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
    };
  }
}
