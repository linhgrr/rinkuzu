export interface Folder {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FolderOverview extends Folder {
  quizCount: number;
}

export interface QuizFolderAccess {
  quizId: string;
  quizOwnerId: string;
  hasAttempt: boolean;
  hasProgress: boolean;
}

export class FolderNameConflictError extends Error {
  constructor() {
    super('A folder with this name already exists');
    this.name = 'FolderNameConflictError';
  }
}
