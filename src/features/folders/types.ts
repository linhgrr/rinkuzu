export interface FolderSummary {
  _id: string;
  name: string;
  quizCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FolderListData {
  folders: FolderSummary[];
  unfiledCount: number;
}
