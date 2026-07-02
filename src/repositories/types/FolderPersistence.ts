import type { MongoIdLike } from '@/types/mongo';

export interface FolderPersistenceRecord {
  _id: MongoIdLike;
  name: string;
  owner: MongoIdLike;
  createdAt: Date;
  updatedAt: Date;
}

export interface FolderOverviewPersistenceRecord extends FolderPersistenceRecord {
  quizCount: number;
}
