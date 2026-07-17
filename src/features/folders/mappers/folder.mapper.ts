import type { FolderListDto, FolderSummaryDto } from '@/dtos/folder';
import type { LibraryListDto, LibraryQuizDto } from '@/dtos/review';
import type {
  FolderLibraryQuizViewModel,
  FolderListViewModel,
  FolderSummaryViewModel,
} from '@/features/folders/types/folder-view-model';

export function toFolderSummaryViewModel(folder: FolderSummaryDto): FolderSummaryViewModel {
  return {
    id: folder.id,
    name: folder.name,
    quizCount: folder.quizCount,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}

export function toFolderListViewModel(dto: FolderListDto): FolderListViewModel {
  return {
    folders: dto.folders.map(toFolderSummaryViewModel),
    unfiledCount: dto.unfiledCount,
  };
}

function toFolderLibraryQuizViewModel(quiz: LibraryQuizDto): FolderLibraryQuizViewModel {
  const { questions: _questions, pdfUrl: _pdfUrl, ...viewModel } = quiz;
  return viewModel;
}

export function toFolderLibraryQuizViewModels(dto: LibraryListDto): FolderLibraryQuizViewModel[] {
  return dto.quizzes.map(toFolderLibraryQuizViewModel);
}
