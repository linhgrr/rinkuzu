import type { DueReviewListDto, SubmitReviewResponseDto } from '@/dtos/review';
import { fetchApiData } from '@/lib/api/client';
import {
  toReviewQuestionViewModels,
  toReviewSubmitPayload,
  toReviewSubmitResultViewModel,
} from '@/features/review/mappers/review-session.mapper';
import type {
  ReviewQuestionViewModel,
  SubmitReviewAnswerInput,
  ReviewSubmitResultViewModel,
} from '@/features/review/types/review-session';

export async function fetchDueReviewQuestionViewModels(): Promise<ReviewQuestionViewModel[]> {
  const data = await fetchApiData<DueReviewListDto>('/api/review/due');
  return toReviewQuestionViewModels(data);
}

export async function submitReviewAnswer({
  question,
  rating,
}: SubmitReviewAnswerInput): Promise<ReviewSubmitResultViewModel> {
  const data = await fetchApiData<SubmitReviewResponseDto>('/api/review/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toReviewSubmitPayload(question, rating)),
  });

  return toReviewSubmitResultViewModel(data);
}
