import type { QuizPlayViewModel } from '@/features/quiz/types/quiz-play-view-model';
import type {
  QuizLandingPreviewOption,
  QuizLandingPreviewQuestion,
  QuizLandingViewModel,
} from '@/features/quiz/types/quiz-landing-view-model';
import type { RelatedQuizDto } from '@/dtos/quiz';
import { copyQuizQuestionContentFields } from '@/lib/quiz/question-fields';
import { isQuickRoundEligible } from '@/shared/constants/quick-round';

/** The landing previews this many leading questions (RIN-1241 C8). */
const QUIZ_LANDING_PREVIEW_SIZE = 5;

const OPTION_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

interface QuizLandingInput {
  /** The canonical route slug. */
  slug: string;
  quiz: QuizPlayViewModel;
  description: string;
  authorName: string | null;
  related: readonly RelatedQuizDto[];
  relatedSameTopic?: boolean;
  topic?: QuizLandingViewModel['topic'];
}

/**
 * Only the question text, options and images are copied: no answer key or
 * explanation can reach the landing HTML or its RSC payload (RIN-1241 C8).
 */
function toPreviewQuestion(
  question: QuizPlayViewModel['questions'][number],
): QuizLandingPreviewQuestion {
  const {
    question: text,
    options,
    questionImage,
    optionImages,
  } = copyQuizQuestionContentFields(question);
  const previewOptions = options.map((option, index): QuizLandingPreviewOption => {
    const letter = OPTION_LETTERS[index] ?? String(index + 1);
    const image = optionImages?.[index];
    return image ? { letter, text: option, image } : { letter, text: option };
  });
  return {
    id: question.id,
    text,
    options: previewOptions,
    ...(questionImage ? { image: questionImage } : {}),
  };
}

export function toQuizLandingViewModel({
  slug,
  quiz,
  description,
  authorName,
  related,
  relatedSameTopic = false,
  topic = null,
}: QuizLandingInput): QuizLandingViewModel {
  return {
    slug,
    title: quiz.title,
    description,
    authorName,
    questionCount: quiz.questionCount,
    quickRoundEligible: isQuickRoundEligible(quiz.questionCount),
    previewQuestions: quiz.questions.slice(0, QUIZ_LANDING_PREVIEW_SIZE).map(toPreviewQuestion),
    related: related.map(({ slug: relatedSlug, title, questionCount }) => ({
      slug: relatedSlug,
      title,
      questionCount,
    })),
    relatedSameTopic,
    topic,
  };
}
