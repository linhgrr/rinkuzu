import type { CreateQuizDraftInputDto } from '@/dtos/quiz-draft';

interface CreateQuizDraftFormValues {
  aiPrompt: string;
  description: string;
  isPrivate: boolean;
  selectedFolderId: string | null;
  title: string;
}

export function toCreateQuizDraftInput(
  state: CreateQuizDraftFormValues,
  file: Pick<File, 'name' | 'size'>,
  s3Key: string,
): CreateQuizDraftInputDto {
  const description = state.description.trim();
  const prompt = state.aiPrompt.trim();

  return {
    title: state.title.trim(),
    s3Key,
    fileName: file.name,
    fileSize: file.size,
    folderId: state.selectedFolderId,
    isPrivate: state.isPrivate,
    ...(description ? { description } : {}),
    ...(prompt ? { prompt } : {}),
  };
}
