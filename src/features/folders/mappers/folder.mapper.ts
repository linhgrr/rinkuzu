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

export function toFolderLibraryQuizViewModel(quiz: LibraryQuizDto): FolderLibraryQuizViewModel {
  return {
    id: quiz.id,
    title: quiz.title,
    slug: quiz.slug,
    description: quiz.description,
    author: quiz.author,
    folder: quiz.folder,
    isPrivate: quiz.isPrivate,
    questionCount: quiz.questionCount,
    ownedByMe: quiz.ownedByMe,
    createdAt: quiz.createdAt,
    updatedAt: quiz.updatedAt,
    lastAttemptAt: quiz.lastAttemptAt,
    lastProgressAt: quiz.lastProgressAt,
    libraryStatus: quiz.libraryStatus,
    displayDate: quiz.displayDate,
  };
}

export function toFolderLibraryQuizViewModels(dto: LibraryListDto): FolderLibraryQuizViewModel[] {
  return dto.quizzes.map(toFolderLibraryQuizViewModel);
}
