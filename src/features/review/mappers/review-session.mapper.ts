import type {
  DueReviewListDto,
  DueReviewQuestionDto,
  QuestionReferenceDto,
  SubmitReviewRequestDto,
  SubmitReviewResponseDto,
} from '@/dtos/review';
import type {
  ReviewQuestionReferenceViewModel,
  ReviewQuestionViewModel,
  ReviewRating,
  ReviewSubmitResultViewModel,
} from '@/features/review/types/review-session';

function toReviewQuestionReferenceViewModel(
  questionRef: QuestionReferenceDto,
): ReviewQuestionReferenceViewModel {
  return {
    text: questionRef.text,
    options: questionRef.options,
    correctIndexes: questionRef.correctIndexes,
  };
}

function toReviewQuestionViewModel(question: DueReviewQuestionDto): ReviewQuestionViewModel | null {
  if (!question.questionRef) return null;

  return {
    id: question.id,
    quizSlug: question.quizSlug,
    questionId: question.questionId,
    questionRef: toReviewQuestionReferenceViewModel(question.questionRef),
  };
}

export function toReviewQuestionViewModels(data: DueReviewListDto): ReviewQuestionViewModel[] {
  return data.questions.flatMap((question) => {
    const viewModel = toReviewQuestionViewModel(question);
    return viewModel ? [viewModel] : [];
  });
}

export function toReviewSubmitPayload(
  question: ReviewQuestionViewModel,
  rating: ReviewRating,
): SubmitReviewRequestDto {
  return {
    questionId: question.questionId,
    quizSlug: question.quizSlug,
    rating,
    questionRef: question.questionRef,
  };
}

export function toReviewSubmitResultViewModel(
  response: SubmitReviewResponseDto,
): ReviewSubmitResultViewModel {
  return {
    xpGained: response.userProgress.xpGained,
  };
}
