import type { QuizPlayViewModel } from '@/features/quiz/types/quiz-play-view-model';
import type {
  QuizLandingPreviewQuestion,
  QuizLandingViewModel,
} from '@/features/quiz/types/quiz-landing-view-model';
import type { RelatedQuizDto } from '@/dtos/quiz';
import { copyQuizQuestionContentFields } from '@/lib/quiz/question-fields';
import { isQuickRoundEligible } from '@/shared/constants/quick-round';

/** The landing previews this many leading questions (RIN-1241 C8). */
export const QUIZ_LANDING_PREVIEW_SIZE = 5;

interface QuizLandingInput {
  /** The canonical route slug. */
  slug: string;
  quiz: QuizPlayViewModel;
  description: string;
  authorName: string | null;
  related: readonly RelatedQuizDto[];
}

/**
 * Only the question text, options and images are copied: no answer key or
 * explanation can reach the landing HTML or its RSC payload (RIN-1241 C8).
 */
function toPreviewQuestion(question: QuizPlayViewModel['questions'][number]) {
  const {
    question: text,
    options,
    questionImage,
    optionImages,
  } = copyQuizQuestionContentFields(question);
  const preview: QuizLandingPreviewQuestion = { text, options: [...options] };
  if (questionImage) preview.image = questionImage;
  if (optionImages?.some(Boolean))
    preview.optionImages = optionImages.map((image) => image ?? null);
  return preview;
}

export function toQuizLandingViewModel({
  slug,
  quiz,
  description,
  authorName,
  related,
}: QuizLandingInput): QuizLandingViewModel {
  return {
    slug,
    title: quiz.title,
    description,
    authorName,
    questionCount: quiz.questionCount,
    quickRoundEligible: isQuickRoundEligible(quiz.questionCount),
    previewQuestions: quiz.questions.slice(0, QUIZ_LANDING_PREVIEW_SIZE).map(toPreviewQuestion),
    related: related.map(({ slug, title, questionCount }) => ({ slug, title, questionCount })),
  };
}
