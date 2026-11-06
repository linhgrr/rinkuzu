'use client';

import { useRouter } from '@/i18n/navigation';
import { useEffect, useReducer, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { captureAnalyticsEvent, captureAnalyticsEventOnce } from '@/lib/analytics/client';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Card, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { preloadMathRenderer } from '@/components/ui/preloadMathRenderer';
import { CenteredCardPageSkeleton } from '@/components/ui/PageLoadingSkeletons';
import { HiOutlineDocumentText } from 'react-icons/hi';
import { PremiumRequiredModal } from '@/features/quiz/components/PremiumRequiredModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useQuizSubmission } from '@/features/quiz/hooks/useQuizSubmission';
import { useQuizProgress } from '@/features/quiz/hooks/useQuizProgress';
import { isQuestionAnswered } from '@/features/quiz/lib/isQuestionAnswered';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { MEDIA_MAX_MD } from '@/shared/constants/breakpoints';
import type {
  QuizAnswer,
  SavedQuizProgress,
} from '@/features/quiz/types/quiz-interaction-view-model';
import type { QuizPlayViewModel } from '@/features/quiz/types/quiz-play-view-model';
import { routePathSegment } from '@/lib/routing/routeParams';
import { describeApiError } from '@/lib/api/error-kind';
import { useApiErrorMessage } from '@/lib/api/use-api-error';
import { StarterQuizIntro } from '@/features/quiz/components/player/StarterQuizIntro';
import { POST_SIGNIN_STARTER_ENTRY } from '@/shared/constants/starter-quiz';
import { isQuickRoundEligible } from '@/shared/constants/quick-round';
import {
  drawQuickRound,
  markQuickRoundSeen,
  readQuickRoundSeen,
} from '@/features/quiz/lib/quick-round-draw';
import {
  QuickRoundChoice,
  type QuizPlayMode,
} from '@/features/quiz/components/player/QuickRoundChoice';

function QuizLayoutLoadingFallback() {
  const t = useTranslations('quiz');
  return <CenteredCardPageSkeleton label={t('loadingQuiz')} />;
}

const DesktopQuizLayout = dynamic(
  () =>
    import('@/features/quiz/components/player/DesktopQuizLayout').then(
      (module) => module.DesktopQuizLayout,
    ),
  { loading: QuizLayoutLoadingFallback },
);

const MobileQuizLayout = dynamic(
  () =>
    import('@/features/quiz/components/player/MobileQuizLayout').then(
      (module) => module.MobileQuizLayout,
    ),
  { loading: QuizLayoutLoadingFallback },
);

type ShuffledQuizQuestion = QuizPlayViewModel['questions'][number] & {
  optionIndexMap: number[];
  originalQuestionIndex: number;
};

type QuizPlayerQuiz = Omit<QuizPlayViewModel, 'questions'> & {
  questions: ShuffledQuizQuestion[];
  questionIndexMap: number[];
};

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const currentValue = shuffled[index];
    const swapValue = shuffled[swapIndex];
    if (currentValue === undefined || swapValue === undefined) {
      throw new Error('Cannot shuffle an array containing missing entries');
    }
    shuffled[index] = swapValue;
    shuffled[swapIndex] = currentValue;
  }

  return shuffled;
}

function createQuizPlayerData(rawQuiz: QuizPlayViewModel, log: (...args: unknown[]) => void) {
  log('\n=== SHUFFLING QUIZ ===');
  log('Original questions count:', rawQuiz.questions.length);

  const questionsWithIndex = rawQuiz.questions.map((question, originalIndex) => ({
    question,
    originalIndex,
  }));
  const shuffledQuestionsWithIndex = shuffleArray(questionsWithIndex);
  const questionIndexMap: number[] = [];

  log('Questions shuffled order:');
  shuffledQuestionsWithIndex.forEach((item, newIndex) => {
    log(`Position ${newIndex + 1}: Question ${item.originalIndex + 1}`);
  });

  const questions = shuffledQuestionsWithIndex.map((item, questionIndex) => {
    const question = item.question;
    const optionsWithIndex = shuffleArray(
      question.options.map((option, originalIndex) => ({
        option,
        originalIndex,
      })),
    );

    questionIndexMap[questionIndex] = item.originalIndex;

    const shuffledOptions = optionsWithIndex.map((optionItem) => optionItem.option);
    const optionIndexMap = optionsWithIndex.map((optionItem) => optionItem.originalIndex);
    const optionImages = question.optionImages
      ? optionsWithIndex.map((optionItem) => question.optionImages?.[optionItem.originalIndex])
      : undefined;

    log(
      `\n=== Processing Question ${questionIndex + 1} (originally Q${item.originalIndex + 1}) ===`,
    );
    log('Original options:', question.options);
    log('Final shuffled options:', shuffledOptions);
    log('Option index map (new -> original):', optionIndexMap);
    log(
      'Was actually shuffled:',
      question.options.length === shuffledOptions.length &&
        question.options.some((option, index) => option !== shuffledOptions[index]),
    );

    return {
      ...question,
      options: shuffledOptions,
      ...(optionImages !== undefined ? { optionImages } : {}),
      optionIndexMap,
      originalQuestionIndex: item.originalIndex,
    };
  });

  const validationErrors: string[] = [];
  questions.forEach((question, index) => {
    if (!Array.isArray(question.optionIndexMap)) {
      validationErrors.push(`Question ${index + 1}: missing optionIndexMap`);
    }
    if (typeof question.originalQuestionIndex !== 'number') {
      validationErrors.push(`Question ${index + 1}: missing originalQuestionIndex`);
    }
  });

  if (questionIndexMap.length !== questions.length) {
    validationErrors.push('Invalid questionIndexMap');
  }

  if (validationErrors.length > 0) {
    throw new Error(`Quiz data validation failed: ${validationErrors.join(', ')}`);
  }

  const initialAnswers: QuizAnswer[] = questions.map((question) =>
    question.type === 'multiple' ? [] : -1,
  );

  log('Initial answers (based on shuffled questions):', initialAnswers);
  log('\n=== QUIZ LOADED ===');
  log('Total questions:', rawQuiz.questions.length);
  log('Questions shuffled:', questions.length);
  log('Question order mapping:', questionIndexMap);
  log('Quiz ready with both question and option shuffling!');

  return {
    quiz: {
      ...rawQuiz,
      questions,
      questionIndexMap,
    } satisfies QuizPlayerQuiz,
    initialAnswers,
  };
}

function rebuildPlayerQuizFromLayout(
  rawQuiz: QuizPlayViewModel,
  questionOrder: number[],
  optionOrders: number[][],
): QuizPlayerQuiz | null {
  if (
    questionOrder.length !== rawQuiz.questions.length ||
    optionOrders.length !== rawQuiz.questions.length ||
    new Set(questionOrder).size !== questionOrder.length ||
    !questionOrder.every(
      (index) => Number.isInteger(index) && index >= 0 && index < rawQuiz.questions.length,
    )
  ) {
    return null;
  }

  const questions: ShuffledQuizQuestion[] = [];

  for (let shuffledIndex = 0; shuffledIndex < questionOrder.length; shuffledIndex += 1) {
    const originalIndex = questionOrder[shuffledIndex];
    const optionIndexMap = optionOrders[shuffledIndex];
    const sourceQuestion =
      originalIndex !== undefined ? rawQuiz.questions[originalIndex] : undefined;

    if (typeof originalIndex !== 'number' || !sourceQuestion || !Array.isArray(optionIndexMap)) {
      return null;
    }
    if (
      optionIndexMap.length !== sourceQuestion.options.length ||
      new Set(optionIndexMap).size !== optionIndexMap.length
    ) {
      return null;
    }

    const optionsValid = optionIndexMap.every(
      (optionOriginal) =>
        typeof optionOriginal === 'number' &&
        optionOriginal >= 0 &&
        optionOriginal < sourceQuestion.options.length,
    );
    if (!optionsValid) {
      return null;
    }

    const options = optionIndexMap.map(
      (optionOriginal) => sourceQuestion.options[optionOriginal] ?? '',
    );
    const optionImages = sourceQuestion.optionImages
      ? optionIndexMap.map((optionOriginal) => sourceQuestion.optionImages?.[optionOriginal])
      : undefined;

    questions.push({
      ...sourceQuestion,
      options,
      ...(optionImages !== undefined ? { optionImages } : {}),
      optionIndexMap,
      originalQuestionIndex: originalIndex,
    });
  }

  return {
    ...rawQuiz,
    questions,
    questionIndexMap: questionOrder,
  } satisfies QuizPlayerQuiz;
}

function countAnswered(quiz: QuizPlayerQuiz, answers: QuizAnswer[]): number {
  return answers.filter((answer, index) => {
    const question = quiz.questions[index];
    return question ? isQuestionAnswered(question, answer) : false;
  }).length;
}

function mapAnswersToOriginalOrder(
  quiz: QuizPlayerQuiz,
  answers: QuizAnswer[],
  log: (...args: unknown[]) => void,
) {
  log('=== SUBMITTING QUIZ ===');
  log('userAnswers:', answers);
  log('questionIndexMap:', quiz.questionIndexMap);

  const convertedAnswers = answers.map((answer, index) => {
    const question = quiz.questions[index];
    if (!question) {
      throw new Error(`Quiz answer at index ${index} has no matching question`);
    }
    const optionIndexMap = question.optionIndexMap;

    if (!Array.isArray(optionIndexMap) || optionIndexMap.length !== question.options.length) {
      throw new Error(`Option mapping is missing for question ${index + 1}`);
    }

    if (question.type === 'single') {
      if (typeof answer !== 'number') {
        throw new Error(`Invalid answer type for single choice question ${index + 1}`);
      }
      if (answer !== -1 && (answer < 0 || answer >= optionIndexMap.length)) {
        throw new Error(`Invalid answer for question ${index + 1}`);
      }
      if (answer === -1) {
        return -1;
      }
      const originalOptionIndex = optionIndexMap[answer];
      if (originalOptionIndex === undefined) {
        throw new Error(`Option mapping is missing for question ${index + 1}`);
      }
      return originalOptionIndex;
    }

    if (!Array.isArray(answer)) {
      throw new Error(`Invalid answer type for multiple choice question ${index + 1}`);
    }

    answer.forEach((answerIndex) => {
      if (
        typeof answerIndex !== 'number' ||
        answerIndex < 0 ||
        answerIndex >= optionIndexMap.length
      ) {
        throw new Error(`Invalid answer for question ${index + 1}`);
      }
    });

    return answer.map((answerIndex) => {
      const originalOptionIndex = optionIndexMap[answerIndex];
      if (originalOptionIndex === undefined) {
        throw new Error(`Option mapping is missing for question ${index + 1}`);
      }
      return originalOptionIndex;
    });
  });

  if (quiz.questionIndexMap.length !== convertedAnswers.length) {
    throw new Error('Question mapping length mismatch');
  }

  const originalOrderAnswers: QuizAnswer[] = new Array(convertedAnswers.length);
  const assignedOriginalIndexes = new Set<number>();
  convertedAnswers.forEach((answer, shuffledIndex) => {
    const originalIndex = quiz.questionIndexMap[shuffledIndex];
    if (
      originalIndex === undefined ||
      !Number.isInteger(originalIndex) ||
      originalIndex < 0 ||
      originalIndex >= convertedAnswers.length ||
      assignedOriginalIndexes.has(originalIndex)
    ) {
      throw new Error(`Invalid question mapping for question ${shuffledIndex + 1}`);
    }
    assignedOriginalIndexes.add(originalIndex);
    originalOrderAnswers[originalIndex] = answer;
  });

  log('convertedAnswers (shuffled order):', convertedAnswers);
  log('originalOrderAnswers (original question order):', originalOrderAnswers);

  return originalOrderAnswers;
}

const DEBUG_QUIZ_FLOW = process.env['NODE_ENV'] !== 'production' && false;
const debugLog = (...args: unknown[]) => {
  if (DEBUG_QUIZ_FLOW) {
    console.warn(...args);
  }
};

/** `choosing`: a long quiz waits for "Quick round" or "Full quiz" (RIN-933). */
type QuizPlayerStatus = 'loading' | 'choosing' | 'ready' | 'error';

interface QuizPlayerState {
  quiz: QuizPlayerQuiz | null;
  status: QuizPlayerStatus;
  /** Inline copy for the submit flow (already localized). */
  error: string;
  /** Why the quiz could not load; rendered by ErrorState, never as text (RIN-753). */
  loadError: unknown;
  currentQuestionIndex: number;
  userAnswers: QuizAnswer[];
  showExitModal: boolean;
  isDiscussionCollapsed: boolean;
  showMobileDiscussion: boolean;
  showPremiumModal: boolean;
  resumePrompt: { currentQuestionIndex: number; userAnswers: QuizAnswer[] } | null;
  /** 1-based question of the saved full-quiz progress, shown on the start choice. */
  choiceResumeQuestion: number | null;
  /** Quick round: the quiz question index of each played question (RIN-933). */
  quickIndices: number[] | null;
}

type QuizPlayerAction =
  | { type: 'patch'; value: Partial<QuizPlayerState> }
  | {
      type: 'loadQuizSuccess';
      quiz: QuizPlayerQuiz;
      userAnswers: QuizAnswer[];
      quickIndices?: number[];
    }
  | {
      type: 'loadQuizWithResume';
      quiz: QuizPlayerQuiz;
      userAnswers: QuizAnswer[];
      resumePrompt: { currentQuestionIndex: number; userAnswers: QuizAnswer[] };
    }
  | { type: 'showModeChoice'; resumeQuestion: number | null }
  | { type: 'acceptResume' }
  | { type: 'declineResume'; quiz: QuizPlayerQuiz; userAnswers: QuizAnswer[] }
  | { type: 'loadQuizError'; error: unknown }
  | { type: 'requirePremium' }
  | { type: 'selectAnswer'; answerIndex: number }
  | { type: 'goToNextQuestion' }
  | { type: 'goToPreviousQuestion' }
  | { type: 'setCurrentQuestionIndex'; value: number };

const initialQuizPlayerState: QuizPlayerState = {
  quiz: null,
  status: 'loading',
  error: '',
  loadError: null,
  currentQuestionIndex: 0,
  userAnswers: [],
  showExitModal: false,
  isDiscussionCollapsed: true,
  showMobileDiscussion: false,
  showPremiumModal: false,
  resumePrompt: null,
  choiceResumeQuestion: null,
  quickIndices: null,
};

function quizPlayerReducer(state: QuizPlayerState, action: QuizPlayerAction): QuizPlayerState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'loadQuizSuccess':
      return {
        ...state,
        quiz: action.quiz,
        userAnswers: action.userAnswers,
        currentQuestionIndex: 0,
        status: 'ready',
        error: '',
        showPremiumModal: false,
        resumePrompt: null,
        quickIndices: action.quickIndices ?? null,
      };
    case 'loadQuizWithResume':
      return {
        ...state,
        quiz: action.quiz,
        userAnswers: action.userAnswers,
        currentQuestionIndex: 0,
        status: 'ready',
        error: '',
        showPremiumModal: false,
        resumePrompt: action.resumePrompt,
      };
    case 'showModeChoice':
      return { ...state, status: 'choosing', choiceResumeQuestion: action.resumeQuestion };
    case 'acceptResume':
      if (!state.resumePrompt) {
        return state;
      }
      return {
        ...state,
        userAnswers: state.resumePrompt.userAnswers,
        currentQuestionIndex: state.resumePrompt.currentQuestionIndex,
        resumePrompt: null,
      };
    case 'declineResume':
      return {
        ...state,
        quiz: action.quiz,
        userAnswers: action.userAnswers,
        currentQuestionIndex: 0,
        resumePrompt: null,
      };
    case 'loadQuizError':
      return {
        ...state,
        status: 'error',
        loadError: action.error,
        showPremiumModal: false,
      };
    case 'requirePremium':
      return {
        ...state,
        status: 'error',
        error: '',
        showPremiumModal: true,
      };
    case 'selectAnswer': {
      if (!state.quiz) {
        return state;
      }

      const question = state.quiz.questions[state.currentQuestionIndex];
      if (!question) {
        return state;
      }
      const nextAnswers = [...state.userAnswers];

      if (question.type === 'single') {
        nextAnswers[state.currentQuestionIndex] = action.answerIndex;
      } else {
        let currentAnswers = nextAnswers[state.currentQuestionIndex];

        if (!Array.isArray(currentAnswers)) {
          currentAnswers = [];
        }

        nextAnswers[state.currentQuestionIndex] = currentAnswers.includes(action.answerIndex)
          ? currentAnswers.filter((answer) => answer !== action.answerIndex)
          : [...currentAnswers, action.answerIndex].sort();
      }

      return {
        ...state,
        userAnswers: nextAnswers,
      };
    }
    case 'goToNextQuestion':
      if (!state.quiz || state.currentQuestionIndex >= state.quiz.questions.length - 1) {
        return state;
      }

      return {
        ...state,
        currentQuestionIndex: state.currentQuestionIndex + 1,
      };
    case 'goToPreviousQuestion':
      if (state.currentQuestionIndex <= 0) {
        return state;
      }

      return {
        ...state,
        currentQuestionIndex: state.currentQuestionIndex - 1,
      };
    case 'setCurrentQuestionIndex':
      return {
        ...state,
        currentQuestionIndex: action.value,
      };
    default:
      return state;
  }
}

function QuizGateHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <CardHeader className="text-center">
      <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-green-500/10 to-accent/10 rounded-2xl mb-4 mx-auto w-fit">
        <HiOutlineDocumentText className="size-6 text-accent" />
      </div>
      <h2 className="mb-2 text-2xl font-semibold text-ink">{title}</h2>
      {subtitle && <p className="text-ink-muted">{subtitle}</p>}
    </CardHeader>
  );
}

function QuizLoadingState({ t }: { t: (key: string) => string }) {
  return <CenteredCardPageSkeleton label={t('loadingQuiz')} />;
}

function QuizPremiumState({ onClose, t }: { onClose: () => void; t: (key: string) => string }) {
  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <Card
          variant="glass"
          className="max-w-md w-full backdrop-blur-xl border-white/30 shadow-xl"
        >
          <QuizGateHeader title={t('quizAccess')} subtitle={t('loadingQuizInfo')} />
        </Card>
      </div>

      <PremiumRequiredModal isOpen onClose={onClose} />
    </div>
  );
}

/** A fresh quick-round draw (RIN-933): the quiz narrowed to 10 questions, unseen first. */
function quickRoundQuiz(quiz: QuizPlayViewModel, slug: string) {
  const questionIndices = drawQuickRound(quiz.questions.length, readQuickRoundSeen(slug));
  const questions = questionIndices.flatMap((index) => {
    const question = quiz.questions[index];
    return question ? [question] : [];
  });
  return { quiz: { ...quiz, questions, questionCount: questions.length }, questionIndices };
}

/** A quick round never reads or overwrites the full quiz's saved progress. */
function playModeSetup(
  playMode: QuizPlayMode | null,
  retrySetup: ReturnType<typeof retrySessionSetup>,
  t: (key: string) => string,
) {
  if (playMode !== 'quick') {
    return {
      progressEnabled: retrySetup.progressEnabled,
      analyticsMode: 'full' as const,
      layoutProps: retrySetup.layout,
    };
  }
  return {
    progressEnabled: false,
    analyticsMode: 'quick' as const,
    layoutProps: { titleBadge: t('quickRound.pill') },
  };
}

function initialPlayMode(
  quiz: QuizPlayViewModel | null,
  mode: string | null | undefined,
): QuizPlayMode | null {
  // Retry sessions and short quizzes always play in full; `?mode=` skips the choice.
  if (!quiz || quiz.retry || !isQuickRoundEligible(quiz.questions.length)) return 'full';
  return mode === 'quick' || mode === 'full' ? mode : null;
}

interface QuizPlayerClientProps {
  initialErrorCode: string | null | undefined;
  /** HTTP status of the server-side load failure; the server's text never reaches the client. */
  initialErrorStatus: number | null;
  initialQuiz: QuizPlayViewModel | null;
  slug: string;
  /** `?entry=` from the URL; `post_signin_starter` when /start opened this quiz (RIN-913). */
  entry?: string | null;
  /** `?mode=quick|full` from the URL: skips the quick-round choice on a long quiz (RIN-933). */
  mode?: string | null;
}

// Opened by /start right after sign-in (RIN-913): intro + Skip, tagged completion.
function postSignInStarterNotice(entry: string | null | undefined, slug: string) {
  return entry === POST_SIGNIN_STARTER_ENTRY ? <StarterQuizIntro quizSlug={slug} /> : null;
}

function postSignInStarterProperties(entry: string | null | undefined) {
  return entry === POST_SIGNIN_STARTER_ENTRY ? { entry: POST_SIGNIN_STARTER_ENTRY } : {};
}

/**
 * `?retryOf` session (RIN-917): a subset of the quiz, so it never reads or writes the full
 * quiz's saved progress, submits as a retry and shows a "Retry: N questions" pill.
 */
function retrySessionSetup(
  quiz: QuizPlayViewModel | null,
  signedIn: boolean,
  t: (key: string, values?: Record<string, number>) => string,
) {
  const retry = quiz?.retry;
  if (!retry) return { progressEnabled: signedIn, submission: {}, layout: {} };
  return {
    progressEnabled: false,
    submission: { retryOfAttemptId: retry.ofAttemptId },
    layout: { titleBadge: t('resultActions.retryPill', { count: retry.questionIndices.length }) },
  };
}

export default function QuizPlayerClient({
  initialErrorCode,
  initialErrorStatus,
  initialQuiz,
  slug,
  entry,
  mode,
}: QuizPlayerClientProps) {
  const t = useTranslations('quiz');
  const { data: session, status: sessionStatus } = useSession();
  const { push, refresh } = useRouter();
  const describeError = useApiErrorMessage();
  const encodedSlug = routePathSegment(slug);
  const [state, dispatch] = useReducer(quizPlayerReducer, initialQuizPlayerState);

  const isMobile = useMediaQuery(MEDIA_MAX_MD);
  const starterNotice = postSignInStarterNotice(entry, slug);

  const sessionEmail = session?.user?.email || undefined;
  const retrySetup = retrySessionSetup(initialQuiz, Boolean(session?.user?.email), t);
  const [playMode, setPlayMode] = useState(() => initialPlayMode(initialQuiz, mode));
  const { progressEnabled, analyticsMode, layoutProps } = playModeSetup(playMode, retrySetup, t);

  const { loadProgress, saveProgress, flushSave, clearProgress } = useQuizProgress({
    slug,
    enabled: progressEnabled,
  });

  useEffect(() => {
    // Fetch KaTeX while auth settles, before the first math question mounts (RIN-679).
    if (initialQuiz) {
      void preloadMathRenderer(
        initialQuiz.questions.flatMap((question) => [question.question, ...question.options]),
      );
    }
  }, [initialQuiz]);

  useEffect(() => {
    // Wait until the auth state is settled so we know whether to look for saved progress.
    if (sessionStatus === 'loading') {
      return;
    }

    let isActive = true;

    const loadQuiz = async () => {
      if (!initialQuiz) {
        // Same classification as a client-side API error (RIN-753).
        const failure = { code: initialErrorCode, status: initialErrorStatus ?? 404 };
        if (describeApiError(failure).kind === 'unlock_required') {
          dispatch({ type: 'requirePremium' });
        } else {
          dispatch({ type: 'loadQuizError', error: failure });
        }
        return;
      }

      const announceStart = (questionCount: number) =>
        captureAnalyticsEvent('quiz_started', {
          mode: analyticsMode,
          question_count: questionCount,
        });

      try {
        const data = initialQuiz;
        if (playMode === 'quick') {
          const round = quickRoundQuiz(data, slug);
          const { quiz: quickQuiz, initialAnswers } = createQuizPlayerData(round.quiz, debugLog);
          dispatch({
            type: 'loadQuizSuccess',
            quiz: quickQuiz,
            userAnswers: initialAnswers,
            quickIndices: round.questionIndices,
          });
          announceStart(quickQuiz.questions.length);
          return;
        }
        const { quiz: nextQuiz, initialAnswers } = createQuizPlayerData(data, debugLog);

        let savedProgress: SavedQuizProgress | null = null;
        if (progressEnabled) {
          savedProgress = await loadProgress();
        }

        if (!isActive) {
          return;
        }

        const hasSavedProgress = Boolean(savedProgress && savedProgress.answeredCount > 0);
        if (playMode === null) {
          dispatch({
            type: 'showModeChoice',
            resumeQuestion:
              savedProgress && hasSavedProgress ? savedProgress.currentQuestionIndex + 1 : null,
          });
          return;
        }

        if (savedProgress && hasSavedProgress) {
          const restoredQuiz = rebuildPlayerQuizFromLayout(
            data,
            savedProgress.questionOrder,
            savedProgress.optionOrders,
          );

          if (restoredQuiz && savedProgress.userAnswers.length === restoredQuiz.questions.length) {
            const safeIndex = Math.min(
              Math.max(savedProgress.currentQuestionIndex, 0),
              restoredQuiz.questions.length - 1,
            );
            dispatch({
              type: 'loadQuizWithResume',
              quiz: restoredQuiz,
              userAnswers: initialAnswers,
              resumePrompt: {
                currentQuestionIndex: safeIndex,
                userAnswers: savedProgress.userAnswers,
              },
            });
            announceStart(restoredQuiz.questions.length);
            return;
          }

          // Saved layout no longer matches the quiz — discard it and start fresh.
          void clearProgress();
        }

        dispatch({ type: 'loadQuizSuccess', quiz: nextQuiz, userAnswers: initialAnswers });
        announceStart(nextQuiz.questions.length);
      } catch (error: unknown) {
        if (!isActive) {
          return;
        }

        dispatch({ type: 'loadQuizError', error });
      }
    };

    void loadQuiz();

    return () => {
      isActive = false;
    };
  }, [
    clearProgress,
    encodedSlug,
    initialErrorCode,
    initialErrorStatus,
    initialQuiz,
    sessionStatus,
    progressEnabled,
    loadProgress,
    playMode,
    analyticsMode,
    slug,
  ]);

  const quiz = state.quiz;
  const currentQuestion = quiz?.questions[state.currentQuestionIndex] || null;
  const answeredQuestions = quiz ? countAnswered(quiz, state.userAnswers) : 0;
  const progress = quiz ? Math.round((answeredQuestions / quiz.questions.length) * 100) : 0;
  const quizJourneyIdRef = useRef<string | null>(null);

  const getQuizJourneyId = () => {
    if (quizJourneyIdRef.current === null) {
      quizJourneyIdRef.current = crypto.randomUUID();
    }
    return quizJourneyIdRef.current;
  };

  const captureFirstQuestionAnswered = () => {
    captureAnalyticsEventOnce('first_question_answered', 'first-question-answered', {
      learning_mode: 'quiz',
      journey_id: getQuizJourneyId(),
    });
  };

  const {
    submitting,
    showSubmitConfirm,
    setShowSubmitConfirm,
    unansweredCount,
    handleQuizComplete,
    completeSubmit,
    submitQuiz,
  } = useQuizSubmission<QuizPlayerQuiz, ShuffledQuizQuestion>({
    slug,
    quiz,
    userAnswers: state.userAnswers,
    ...(sessionEmail !== undefined ? { sessionEmail } : {}),
    ...retrySetup.submission,
    ...(state.quickIndices ? { questionIndices: state.quickIndices } : {}),
    onSubmitSuccess: async (attemptId, score) => {
      captureAnalyticsEvent('quiz_completed', {
        journey_id: getQuizJourneyId(),
        question_count: quiz?.questions.length ?? 0,
        score,
        authenticated: Boolean(sessionEmail),
        mode: analyticsMode,
        ...postSignInStarterProperties(entry),
      });
      // Only a submitted round counts as seen, so the next draw prefers the rest.
      if (state.quickIndices) markQuickRoundSeen(slug, state.quickIndices);
      // Cancel pending/in-flight autosaves and wait for the DELETE before
      // navigation. This prevents the submit flow from racing the progress
      // cleanup and avoids resurrecting a just-completed attempt.
      await clearProgress();
      // A guest's claim token stays in localStorage; the URL never carries an email (RIN-912).
      const params = new URLSearchParams({
        attemptId,
        score: String(score),
      });
      push(`/quiz/${encodedSlug}/result?${params.toString()}`);
    },
    onSubmitStart: () => dispatch({ type: 'patch', value: { error: '' } }),
    onSubmitError: (error) => dispatch({ type: 'patch', value: { error: describeError(error) } }),
    mapAnswersToOriginalOrder: (currentQuiz, answersToSubmit) =>
      mapAnswersToOriginalOrder(currentQuiz, answersToSubmit, debugLog),
    isQuestionAnswered,
  });

  const exitQuiz = () => {
    void flushSave();
    push('/');
  };
  const flushSaveRef = useRef(flushSave);

  useEffect(() => {
    flushSaveRef.current = flushSave;
  }, [flushSave]);

  // Auto-save in-progress state (logged-in users only). The resume prompt is
  // still pending until the user answers it, so don't save during that window.
  useEffect(() => {
    if (!progressEnabled || !quiz || state.status !== 'ready' || state.resumePrompt) {
      return;
    }

    const answeredCount = countAnswered(quiz, state.userAnswers);
    if (answeredCount === 0) {
      return;
    }

    saveProgress({
      questionOrder: quiz.questionIndexMap,
      optionOrders: quiz.questions.map((question) => question.optionIndexMap),
      userAnswers: state.userAnswers,
      currentQuestionIndex: state.currentQuestionIndex,
      answeredCount,
      totalQuestions: quiz.questions.length,
    });
  }, [
    progressEnabled,
    quiz,
    state.status,
    state.resumePrompt,
    state.userAnswers,
    state.currentQuestionIndex,
    saveProgress,
  ]);

  // Persist progress if the tab is closed/hidden mid-quiz.
  useEffect(() => {
    if (!progressEnabled) {
      return;
    }

    const handleBeforeUnload = () => {
      void flushSaveRef.current();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void flushSaveRef.current();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [progressEnabled]);

  const handleAcceptResume = () => {
    dispatch({ type: 'acceptResume' });
  };

  const handleDeclineResume = () => {
    void clearProgress();
    if (state.quiz) {
      const initialAnswers: QuizAnswer[] = state.quiz.questions.map((question) =>
        question.type === 'multiple' ? [] : -1,
      );
      dispatch({ type: 'declineResume', quiz: state.quiz, userAnswers: initialAnswers });
    }
  };

  if (state.status === 'loading') {
    return <QuizLoadingState t={t} />;
  }

  if (state.status === 'choosing' && initialQuiz) {
    return (
      <QuickRoundChoice
        slug={slug}
        title={initialQuiz.title}
        {...(initialQuiz.description ? { description: initialQuiz.description } : {})}
        questionCount={initialQuiz.questions.length}
        resumeQuestion={state.choiceResumeQuestion}
        onChoose={(chosen) => {
          dispatch({ type: 'patch', value: { status: 'loading' } });
          setPlayMode(chosen);
        }}
      />
    );
  }

  if (state.showPremiumModal) {
    return (
      <QuizPremiumState
        onClose={() => dispatch({ type: 'patch', value: { showPremiumModal: false } })}
        t={t}
      />
    );
  }

  if (state.loadError !== null && !quiz) {
    // The whole player failed to load: page variant, copy from the error layer (RIN-753).
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <ErrorState error={state.loadError} variant="page" onRetry={refresh} />
      </div>
    );
  }

  if (!quiz || !currentQuestion) {
    return null;
  }

  return (
    <>
      {state.resumePrompt && <div className="min-h-screen" aria-hidden="true" />}

      {!state.resumePrompt && isMobile && (
        <MobileQuizLayout
          quiz={quiz}
          userAnswers={state.userAnswers}
          currentQuestionIndex={state.currentQuestionIndex}
          onAnswersChange={(answers) => {
            captureFirstQuestionAnswered();
            dispatch({ type: 'patch', value: { userAnswers: answers } });
          }}
          onIndexChange={(index) => dispatch({ type: 'setCurrentQuestionIndex', value: index })}
          onComplete={handleQuizComplete}
          onExit={() => {
            void flushSave();
            push('/');
          }}
          submitting={submitting}
          error={state.error}
          notice={starterNotice}
          {...layoutProps}
        />
      )}

      {!state.resumePrompt && !isMobile && (
        <DesktopQuizLayout
          slug={slug}
          quizTitle={quiz.title}
          questions={quiz.questions}
          {...(sessionEmail !== undefined ? { sessionEmail } : {})}
          currentQuestionIndex={state.currentQuestionIndex}
          setCurrentQuestionIndex={(index) =>
            dispatch({ type: 'setCurrentQuestionIndex', value: index })
          }
          answeredQuestions={answeredQuestions}
          progress={progress}
          currentQuestion={currentQuestion}
          userAnswers={state.userAnswers}
          discussion={{
            collapsed: state.isDiscussionCollapsed,
            setCollapsed: (collapsed) =>
              dispatch({ type: 'patch', value: { isDiscussionCollapsed: collapsed } }),
            mobileOpen: state.showMobileDiscussion,
            setMobileOpen: (show) =>
              dispatch({ type: 'patch', value: { showMobileDiscussion: show } }),
          }}
          exit={{
            isOpen: state.showExitModal,
            open: () => dispatch({ type: 'patch', value: { showExitModal: true } }),
            close: () => dispatch({ type: 'patch', value: { showExitModal: false } }),
            confirmExit: exitQuiz,
          }}
          error={state.error}
          selectAnswer={(answerIndex) => {
            captureFirstQuestionAnswered();
            dispatch({ type: 'selectAnswer', answerIndex });
          }}
          previousQuestion={() => dispatch({ type: 'goToPreviousQuestion' })}
          nextQuestion={() => dispatch({ type: 'goToNextQuestion' })}
          submitQuiz={submitQuiz}
          submitting={submitting}
          submit={{
            confirmOpen: showSubmitConfirm,
            setConfirmOpen: setShowSubmitConfirm,
            unansweredCount,
            complete: completeSubmit,
          }}
          notice={starterNotice}
          {...layoutProps}
          t={t}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(state.resumePrompt)}
        title={t('resumeTitle')}
        message={t('resumeMessage', {
          question: (state.resumePrompt?.currentQuestionIndex ?? 0) + 1,
        })}
        confirmText={t('resumeContinue')}
        cancelText={t('resumeRestart')}
        confirmVariant="primary"
        onConfirm={handleAcceptResume}
        onCancel={handleDeclineResume}
      />
    </>
  );
}
