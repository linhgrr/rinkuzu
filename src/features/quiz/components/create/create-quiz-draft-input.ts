interface CreateQuizDraftFormValues {
  aiPrompt: string;
  description: string;
  isPrivate: boolean;
  selectedFolderId: string | null;
  title: string;
}

interface CreateQuizDraftInput {
  description?: string;
  fileName: string;
  fileSize: number;
  folderId: string | null;
  isPrivate: boolean;
  prompt?: string;
  s3Key: string;
  title: string;
}

export function toCreateQuizDraftInput(
  state: CreateQuizDraftFormValues,
  file: Pick<File, 'name' | 'size'>,
  s3Key: string,
): CreateQuizDraftInput {
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
