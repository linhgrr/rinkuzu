import type { Folder, FolderOverview } from '@/entities/Folder';
import { serializeId } from '@/lib/mongo-id';
import type {
  FolderOverviewPersistenceRecord,
  FolderPersistenceRecord,
} from '@/repositories/types/FolderPersistence';

export class FolderPersistenceMapper {
  static toEntity(record: FolderPersistenceRecord): Folder {
    return {
      id: serializeId(record._id, 'folder._id'),
      name: record.name,
      ownerId: serializeId(record.owner, 'folder.owner'),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  static toOverview(record: FolderOverviewPersistenceRecord): FolderOverview {
    return {
      ...FolderPersistenceMapper.toEntity(record),
      quizCount: record.quizCount,
    };
  }
}
