// Client for the FastAPI-owned quiz draft lifecycle, reached through the
// same-origin Next proxy at /api/quiz-drafts/* (which injects the internal
// service token server-side). The FastAPI contract uses snake_case fields.
import { fetchApiData } from '@/lib/api/client';
import type {
  CreateQuizDraftInputDto,
  PatchQuizDraftInputDto,
  QuizDraftListResponseDto,
  QuizDraftSingleResponseDto,
  SubmitQuizDraftInputDto,
  SubmitQuizDraftResultDto,
} from '@/dtos/quiz-draft';
import type { QuizDraft } from '@/features/quiz/types/quiz-draft';
import { QuizDraftMapper } from '@/mappers/quiz/QuizDraftMapper';

export async function createQuizDraft(input: CreateQuizDraftInputDto): Promise<QuizDraft> {
  const { draft } = await fetchApiData<QuizDraftSingleResponseDto>('/api/quiz-drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      s3_key: input.s3Key,
      file_name: input.fileName,
      file_size: input.fileSize,
      category_id: input.folderId,
      description: input.description,
      prompt: input.prompt,
    }),
  });
  return QuizDraftMapper.toViewModel(draft);
}

export async function getQuizDraft(
  draftId: string,
  init?: { signal?: AbortSignal },
): Promise<QuizDraft> {
  const { draft } = await fetchApiData<QuizDraftSingleResponseDto>(
    `/api/quiz-drafts/${draftId}`,
    init,
  );
  return QuizDraftMapper.toViewModel(draft);
}

export async function listQuizDrafts(init?: { signal?: AbortSignal }): Promise<QuizDraft[]> {
  const { drafts } = await fetchApiData<QuizDraftListResponseDto>('/api/quiz-drafts', init);
  return drafts.map(QuizDraftMapper.toViewModel);
}

export async function patchQuizDraft(
  draftId: string,
  input: PatchQuizDraftInputDto,
): Promise<QuizDraft> {
  const { draft } = await fetchApiData<QuizDraftSingleResponseDto>(`/api/quiz-drafts/${draftId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      category_id: input.folderId,
      questions: input.questions,
    }),
  });
  return QuizDraftMapper.toViewModel(draft);
}

export async function deleteQuizDraft(draftId: string): Promise<void> {
  await fetchApiData(`/api/quiz-drafts/${draftId}`, { method: 'DELETE' });
}

export async function submitQuizDraft(
  draftId: string,
  input: SubmitQuizDraftInputDto,
): Promise<SubmitQuizDraftResultDto> {
  return fetchApiData<SubmitQuizDraftResultDto>(`/api/quiz-drafts/${draftId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
