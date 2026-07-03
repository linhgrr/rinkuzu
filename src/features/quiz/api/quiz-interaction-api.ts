import type {
  DeleteQuizProgressResponseDto,
  QuizAttemptResultDto,
  QuizDiscussionDto,
  QuizProgressResponseDto,
  ReportQuizResponseDto,
  SaveQuizProgressResponseDto,
} from '@/dtos/quiz';
import {
  toQuizAttemptResultViewModel,
  toQuizDiscussionViewModel,
  toSavedQuizProgressViewModel,
} from '@/features/quiz/mappers/quiz-interaction.mapper';
import type {
  AddQuizDiscussionCommentInput,
  QuizAttemptResultViewModel,
  QuizDiscussionViewModel,
  SavedQuizProgress,
  SubmitQuizAttemptInput,
} from '@/features/quiz/types/quiz-interaction-view-model';
import { fetchApiData } from '@/lib/api/client';
import { routePathSegment } from '@/lib/routing/routeParams';

function quizProgressUrl(slug: string): string {
  return `/api/quiz/${routePathSegment(slug)}/progress`;
}

export async function submitQuizAttemptViewModel({
  slug,
  answers,
  userEmail,
}: SubmitQuizAttemptInput): Promise<QuizAttemptResultViewModel> {
  const encodedSlug = routePathSegment(slug);
  const dto = await fetchApiData<QuizAttemptResultDto>(`/api/quiz/${encodedSlug}/attempt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers, userEmail }),
  });
  return toQuizAttemptResultViewModel(dto);
}

export async function loadSavedQuizProgress(slug: string): Promise<SavedQuizProgress | null> {
  const dto = await fetchApiData<QuizProgressResponseDto>(quizProgressUrl(slug));
  return dto.progress ? toSavedQuizProgressViewModel(dto.progress) : null;
}

export async function saveQuizProgress(
  slug: string,
  progress: SavedQuizProgress,
): Promise<SaveQuizProgressResponseDto> {
  return fetchApiData<SaveQuizProgressResponseDto>(quizProgressUrl(slug), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(progress),
    keepalive: true,
  });
}

export async function deleteSavedQuizProgress(
  slug: string,
): Promise<DeleteQuizProgressResponseDto> {
  return fetchApiData<DeleteQuizProgressResponseDto>(quizProgressUrl(slug), {
    method: 'DELETE',
  });
}

export async function fetchQuizDiscussionViewModels(
  slug: string,
): Promise<QuizDiscussionViewModel[]> {
  const encodedSlug = routePathSegment(slug);
  const dto = await fetchApiData<QuizDiscussionDto[]>(`/api/quiz/${encodedSlug}/discussions`);
  return dto.map(toQuizDiscussionViewModel);
}

export async function addQuizDiscussionCommentViewModel({
  slug,
  questionIndex,
  content,
}: AddQuizDiscussionCommentInput): Promise<QuizDiscussionViewModel> {
  const encodedSlug = routePathSegment(slug);
  const dto = await fetchApiData<QuizDiscussionDto>(`/api/quiz/${encodedSlug}/discussions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionIndex, content }),
  });
  return toQuizDiscussionViewModel(dto);
}

export async function reportQuizViewModel(
  slug: string,
  content: string,
): Promise<ReportQuizResponseDto> {
  const encodedSlug = routePathSegment(slug);
  return fetchApiData<ReportQuizResponseDto>(`/api/quiz/${encodedSlug}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}
