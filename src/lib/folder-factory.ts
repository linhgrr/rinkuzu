import { FolderRepository } from '@/repositories/FolderRepository';
import { FolderService } from '@/services/folder/FolderService';

let folderService: FolderService | undefined;

export function getFolderService(): FolderService {
  folderService ??= new FolderService(new FolderRepository());
  return folderService;
}
