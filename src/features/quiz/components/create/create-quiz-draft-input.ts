import type { OfficeSource } from '@/features/quiz/components/create/office-source';

interface CreateQuizDraftFormValues {
  aiPrompt: string;
  description: string;
  submitToPremium: boolean;
  selectedFolderId: string | null;
  title: string;
}

interface CreateQuizDraftInput {
  description?: string;
  fileName: string;
  fileSize: number;
  folderId: string | null;
  submitToPremium: boolean;
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
    submitToPremium: state.submitToPremium,
    ...(description ? { description } : {}),
    ...(prompt ? { prompt } : {}),
  };
}

/** The text draft of a Word or PowerPoint file; the shape `createTextQuizDraft` takes. */
interface OfficeTextDraftInput {
  title: string;
  text: string;
  folderId: string | null;
  submitToPremium: boolean;
  office: { fileType: OfficeSource['fileType']; surface: 'create_pdf' | 'create_pdf_mobile' };
  description?: string;
  prompt?: string;
}

/**
 * The text draft for a Word or PowerPoint file read in the browser (RIN-1787): the title
 * defaults to the file name (already in the form state), the file itself is never uploaded.
 */
export function toOfficeTextDraftInput(
  state: CreateQuizDraftFormValues,
  source: OfficeSource,
  surface: OfficeTextDraftInput['office']['surface'],
): OfficeTextDraftInput {
  const description = state.description.trim();
  const prompt = state.aiPrompt.trim();

  return {
    title: state.title.trim(),
    text: source.text,
    folderId: state.selectedFolderId,
    submitToPremium: state.submitToPremium,
    office: { fileType: source.fileType, surface },
    ...(description ? { description } : {}),
    ...(prompt ? { prompt } : {}),
  };
}
