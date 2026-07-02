import type { Folder, FolderOverview, QuizFolderAccess } from '@/entities/Folder';

export interface CreateFolderData {
  name: string;
  ownerId: string;
}

export interface FolderOverviewResult {
  folders: FolderOverview[];
  unfiledCount: number;
}

export interface IFolderRepository {
  listOverviewByOwner(ownerId: string): Promise<FolderOverviewResult>;

  create(data: CreateFolderData): Promise<Folder>;

  findOwnedById(folderId: string, ownerId: string): Promise<Folder | null>;

  existsOwnedById(folderId: string, ownerId: string): Promise<boolean>;

  rename(folderId: string, ownerId: string, name: string): Promise<Folder | null>;

  deleteOwned(folderId: string, ownerId: string): Promise<boolean>;

  findQuizAccess(userId: string, quizId: string): Promise<QuizFolderAccess | null>;

  saveQuizPlacement(
    userId: string,
    quizId: string,
    quizOwnerId: string,
    folderId: string | null,
  ): Promise<void>;
}
