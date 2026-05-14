'use client';

import { useEffect, useMemo, useReducer } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
  HiOutlineLightBulb,
  HiOutlineArrowLeft,
  HiOutlineMail,
  HiOutlineExclamationCircle,
  HiOutlineDocumentText,
  HiOutlineLightningBolt,
  HiOutlineRefresh,
} from '@/components/icons';
import { PremiumRequiredModal } from '@/features/quiz/components/PremiumRequiredModal';
import { DesktopQuizLayout } from '@/features/quiz/components/player/DesktopQuizLayout';
import { MobileQuizLayout } from '@/features/quiz/components/player/MobileQuizLayout';
import { useQuizAIExplain } from '@/features/quiz/hooks/useQuizAIExplain';
import { useQuizSubmission } from '@/features/quiz/hooks/useQuizSubmission';
import { useQuizViewport } from '@/features/quiz/hooks/useQuizViewport';
import { IQuiz } from '@/types';
import { fetchApiData } from '@/lib/api/client';
import { routePathSegment } from '@/lib/routing/routeParams';
import { useRequiredRouteParam } from '@/lib/routing/useRequiredRouteParam';
import { QuizPageSchema } from '@/components/seo/QuizPageSchema';
import { getUserDisplayName } from '@/components/user/UserAvatar';

type ShuffledQuizQuestion = IQuiz['questions'][number] & {
  optionIndexMap: number[];
  originalQuestionIndex: number;
};

type QuizPlayerQuiz = Omit<IQuiz, 'questions'> & {
  questions: ShuffledQuizQuestion[];
  questionIndexMap: number[];
};

type QuizAnswer = number | number[];

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function createQuizPlayerData(rawQuiz: IQuiz, log: (...args: unknown[]) => void) {
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
        !question.options.every((option, index) => option === shuffledOptions[index]),
    );

    return {
      ...question,
      options: shuffledOptions,
      optionImages,
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

function isQuestionAnswered(question: ShuffledQuizQuestion, answer: QuizAnswer): boolean {
  if (question.type === 'single') {
    return answer !== -1;
  }

  return Array.isArray(answer) && answer.length > 0;
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
      return answer === -1 ? -1 : optionIndexMap[answer];
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

    return answer.map((answerIndex) => optionIndexMap[answerIndex]);
  });

  if (quiz.questionIndexMap.length !== convertedAnswers.length) {
    throw new Error('Question mapping length mismatch');
  }

  const originalOrderAnswers: QuizAnswer[] = new Array(convertedAnswers.length);
  convertedAnswers.forEach((answer, shuffledIndex) => {
    const originalIndex = quiz.questionIndexMap[shuffledIndex];
    if (originalIndex < 0 || originalIndex >= convertedAnswers.length) {
      throw new Error(`Invalid question mapping for question ${shuffledIndex + 1}`);
    }
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

type QuizPlayerStatus = 'loading' | 'ready' | 'error';

interface QuizPlayerState {
  quiz: QuizPlayerQuiz | null;
  status: QuizPlayerStatus;
  error: string;
  userEmail: string;
  showEmailInput: boolean;
  currentQuestionIndex: number;
  userAnswers: QuizAnswer[];
  showExitModal: boolean;
  isDiscussionCollapsed: boolean;
  showMobileDiscussion: boolean;
  showPremiumModal: boolean;
}

type QuizPlayerAction =
  | { type: 'patch'; value: Partial<QuizPlayerState> }
  | { type: 'setSessionEmail'; email: string }
  | { type: 'loadQuizSuccess'; quiz: QuizPlayerQuiz; userAnswers: QuizAnswer[] }
  | { type: 'loadQuizError'; error: string }
  | { type: 'requirePremium' }
  | { type: 'selectAnswer'; answerIndex: number }
  | { type: 'goToNextQuestion' }
  | { type: 'goToPreviousQuestion' }
  | { type: 'setCurrentQuestionIndex'; value: number };

const initialQuizPlayerState: QuizPlayerState = {
  quiz: null,
  status: 'loading',
  error: '',
  userEmail: '',
  showEmailInput: true,
  currentQuestionIndex: 0,
  userAnswers: [],
  showExitModal: false,
  isDiscussionCollapsed: true,
  showMobileDiscussion: false,
  showPremiumModal: false,
};

function quizPlayerReducer(state: QuizPlayerState, action: QuizPlayerAction): QuizPlayerState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'setSessionEmail':
      return {
        ...state,
        userEmail: action.email,
        showEmailInput: false,
      };
    case 'loadQuizSuccess':
      return {
        ...state,
        quiz: action.quiz,
        userAnswers: action.userAnswers,
        status: 'ready',
        error: '',
        showPremiumModal: false,
      };
    case 'loadQuizError':
      return {
        ...state,
        status: 'error',
        error: action.error,
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

function QuizLoadingState({ t }: { t: (key: string) => string }) {
  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-green-500/10 to-brand-trust/10 rounded-2xl mb-6">
            <div className="size-8 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
          </div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">{t('loadingQuiz')}</h2>
          <p className="text-neutral-600">{t('preparingQuiz')}</p>
        </div>
      </div>
    </div>
  );
}

function QuizErrorState({ error, t }: { error: string; t: (key: string) => string }) {
  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <Card
          variant="glass"
          className="max-w-md w-full backdrop-blur-xl border-white/30 shadow-xl"
        >
          <CardHeader className="text-center">
            <div className="inline-flex items-center justify-center p-3 bg-red-100 rounded-2xl mb-4 mx-auto w-fit">
              <HiOutlineExclamationCircle className="size-6 text-red-600" />
            </div>
            <CardTitle className="text-red-600 text-xl">{t('quizNotFound')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-neutral-600 mb-6">{error}</p>
            <Link href="/">
              <Button variant="gradient" className="w-full">
                <HiOutlineArrowLeft className="size-4 mr-2" />
                {t('returnHome')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuizPremiumState({ onClose, t }: { onClose: () => void; t: (key: string) => string }) {
  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <Card
          variant="glass"
          className="max-w-md w-full backdrop-blur-xl border-white/30 shadow-xl"
        >
          <CardHeader className="text-center">
            <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-green-500/10 to-brand-trust/10 rounded-2xl mb-4 mx-auto w-fit">
              <HiOutlineDocumentText className="size-6 text-brand-trust" />
            </div>
            <CardTitle className="text-2xl text-neutral-900 mb-2">{t('quizAccess')}</CardTitle>
            <p className="text-neutral-600">{t('loadingQuizInfo')}</p>
          </CardHeader>
        </Card>
      </div>

      <PremiumRequiredModal isOpen onClose={onClose} />
    </div>
  );
}

function QuizEmailGate({
  encodedSlug,
  error,
  onStartQuiz,
  onUserEmailChange,
  quiz,
  t,
  userEmail,
}: {
  encodedSlug: string;
  error: string;
  onStartQuiz: () => void;
  onUserEmailChange: (value: string) => void;
  quiz: QuizPlayerQuiz;
  t: (key: string) => string;
  userEmail: string;
}) {
  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <Card
          variant="glass"
          className="max-w-lg w-full backdrop-blur-xl border-white/30 shadow-xl animate-fadeInUp"
        >
          <CardHeader className="text-center">
            <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-green-500/10 to-brand-trust/10 rounded-2xl mb-4 mx-auto w-fit">
              <HiOutlineDocumentText className="size-6 text-brand-trust" />
            </div>
            <CardTitle className="text-2xl text-neutral-900 mb-2">{quiz.title}</CardTitle>
            {quiz.description && <p className="text-neutral-600">{quiz.description}</p>}
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex justify-center gap-x-8 py-4 bg-neutral-50/50 rounded-xl">
                <div className="text-center">
                  <Badge variant="purple" className="mb-1">
                    {quiz.questions.length} {t('questions')}
                  </Badge>
                </div>
                <div className="text-center">
                  <Badge variant="info" className="mb-1">
                    {t('noTimeLimit')}
                  </Badge>
                </div>
              </div>

              {error && (
                <Card variant="bordered" className="border-red-200 bg-red-50 p-4">
                  <div className="flex items-center text-red-700">
                    <HiOutlineExclamationCircle className="size-5 mr-2 flex-shrink-0" />
                    <span className="text-sm font-medium">{error}</span>
                  </div>
                </Card>
              )}

              <Card variant="bordered" className="border-green-200 bg-green-50 p-4">
                <div className="text-center text-brand-trust">
                  <HiOutlineLightBulb className="size-6 mx-auto mb-2 text-brand-trust" />
                  <p className="text-sm font-medium">
                    <Link href="/login" className="underline hover:text-green-700">
                      {t('login')}
                    </Link>{' '}
                    {t('loginToTrack')}
                  </p>
                </div>
              </Card>

              <div>
                <Input
                  label={t('yourEmail')}
                  id="email"
                  type="email"
                  value={userEmail}
                  onChange={(event) => onUserEmailChange(event.target.value)}
                  placeholder={t('enterEmailAddress')}
                  required
                  icon={<HiOutlineMail className="size-5" />}
                />
                <p className="mt-2 text-xs text-neutral-500">{t('weWillUseEmail')}</p>
              </div>

              <div className="space-y-3">
                <Button onClick={onStartQuiz} variant="gradient" size="lg" className="w-full">
                  <HiOutlineLightningBolt className="size-5 mr-2" />
                  {t('startQuiz')}
                </Button>

                <div className="grid grid-cols-2 gap-3">
                  <Link href="/">
                    <Button variant="outline" className="w-full">
                      <HiOutlineArrowLeft className="size-4 mr-2" />
                      {t('backHome')}
                    </Button>
                  </Link>
                  <Link href={`/quiz/${encodedSlug}/flashcards`}>
                    <Button variant="accent" className="w-full">
                      <HiOutlineRefresh className="size-4 mr-2" />
                      {t('flashcards')}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function QuizPlayerPage() {
  const t = useTranslations('quiz');
  const { data: session } = useSession();
  const { push } = useRouter();
  const slug = useRequiredRouteParam('slug');
  const encodedSlug = routePathSegment(slug);
  const [state, dispatch] = useReducer(quizPlayerReducer, initialQuizPlayerState);

  const { isMobile } = useQuizViewport();

  const {
    showAIModal,
    aiExplanation,
    userQuestion,
    setUserQuestion,
    loadingAI,
    aiError,
    askAI,
    openAIModal,
    closeAIModal,
  } = useQuizAIExplain();
  const sessionEmail = session?.user?.email || undefined;

  useEffect(() => {
    if (session?.user?.email) {
      dispatch({ type: 'setSessionEmail', email: session.user.email });
    }
  }, [session]);

  useEffect(() => {
    let isActive = true;

    const loadQuiz = async () => {
      try {
        const data = await fetchApiData<IQuiz>(`/api/quiz/${encodedSlug}/play`);
        const { quiz: nextQuiz, initialAnswers } = createQuizPlayerData(data, debugLog);

        if (isActive) {
          dispatch({ type: 'loadQuizSuccess', quiz: nextQuiz, userAnswers: initialAnswers });
        }
      } catch (error: any) {
        if (!isActive) {
          return;
        }

        if (error.message === 'Premium subscription required to access private quizzes') {
          dispatch({ type: 'requirePremium' });
        } else {
          dispatch({ type: 'loadQuizError', error: error.message || 'Quiz not found' });
        }
      }
    };

    void loadQuiz();

    return () => {
      isActive = false;
    };
  }, [encodedSlug]);

  const startQuiz = () => {
    if (!sessionEmail && !state.userEmail.trim()) {
      dispatch({ type: 'patch', value: { error: 'Please enter your email to start the quiz' } });
      return;
    }

    dispatch({ type: 'patch', value: { showEmailInput: false, error: '' } });
  };

  const quiz = state.quiz;
  const currentQuestion = quiz?.questions[state.currentQuestionIndex] || null;
  const answeredQuestions = useMemo(
    () =>
      quiz
        ? state.userAnswers.filter((answer, index) =>
            isQuestionAnswered(quiz.questions[index], answer),
          ).length
        : 0,
    [quiz, state.userAnswers],
  );
  const progress = quiz
    ? Math.round(((state.currentQuestionIndex + 1) / quiz.questions.length) * 100)
    : 0;

  const {
    submitting,
    showSubmitConfirm,
    setShowSubmitConfirm,
    unansweredCount,
    handleQuizComplete,
    completeSubmit,
    submitQuiz,
  } = useQuizSubmission<QuizPlayerQuiz>({
    slug,
    quiz,
    userAnswers: state.userAnswers,
    userEmail: state.userEmail,
    sessionEmail,
    onSubmitSuccess: (attemptId, score) => {
      push(`/quiz/${encodedSlug}/result?attemptId=${attemptId}&score=${score}`);
    },
    onSubmitStart: () => dispatch({ type: 'patch', value: { error: '' } }),
    onSubmitError: (message) => dispatch({ type: 'patch', value: { error: message } }),
    mapAnswersToOriginalOrder: (currentQuiz, answersToSubmit) =>
      mapAnswersToOriginalOrder(currentQuiz, answersToSubmit, debugLog),
    isQuestionAnswered,
  });

  const exitQuiz = () => {
    push('/');
  };

  if (state.status === 'loading') {
    return <QuizLoadingState t={t} />;
  }

  if (state.showPremiumModal) {
    return (
      <QuizPremiumState
        onClose={() => dispatch({ type: 'patch', value: { showPremiumModal: false } })}
        t={t}
      />
    );
  }

  if (state.error && !quiz) {
    return <QuizErrorState error={state.error} t={t} />;
  }

  if (state.showEmailInput && !sessionEmail && quiz) {
    return (
      <QuizEmailGate
        encodedSlug={encodedSlug}
        error={state.error}
        onStartQuiz={startQuiz}
        onUserEmailChange={(value) => dispatch({ type: 'patch', value: { userEmail: value } })}
        quiz={quiz}
        t={t}
        userEmail={state.userEmail}
      />
    );
  }

  if (!quiz || !currentQuestion) {
    return null;
  }

  const authorName =
    typeof quiz.author === 'string'
      ? quiz.author
      : getUserDisplayName(quiz.author as any) || 'RinKuzu Community';
  const categoryName =
    typeof quiz.category === 'string' ? quiz.category : (quiz.category as any)?.name || undefined;

  return (
    <>
      <QuizPageSchema
        quizSlug={slug}
        quizTitle={quiz.title}
        quizDescription={quiz.description}
        authorName={authorName}
        categoryName={categoryName}
        questionCount={quiz.questions.length}
      />

      {isMobile && !state.showEmailInput && (
        <MobileQuizLayout
          quiz={quiz}
          onComplete={handleQuizComplete}
          onExit={() => push('/')}
          submitting={submitting}
          error={state.error}
        />
      )}

      {!isMobile && (
        <DesktopQuizLayout
          slug={slug}
          quizTitle={quiz.title}
          questions={quiz.questions}
          sessionEmail={sessionEmail}
          userEmail={state.userEmail}
          currentQuestionIndex={state.currentQuestionIndex}
          setCurrentQuestionIndex={(index) =>
            dispatch({ type: 'setCurrentQuestionIndex', value: index })
          }
          answeredQuestions={answeredQuestions}
          progress={progress}
          currentQuestion={currentQuestion}
          userAnswers={state.userAnswers}
          isDiscussionCollapsed={state.isDiscussionCollapsed}
          setIsDiscussionCollapsed={(collapsed) =>
            dispatch({ type: 'patch', value: { isDiscussionCollapsed: collapsed } })
          }
          openAIModal={openAIModal}
          showMobileDiscussion={state.showMobileDiscussion}
          setShowMobileDiscussion={(show) =>
            dispatch({ type: 'patch', value: { showMobileDiscussion: show } })
          }
          showExitModal={state.showExitModal}
          openExitModal={() => dispatch({ type: 'patch', value: { showExitModal: true } })}
          closeExitModal={() => dispatch({ type: 'patch', value: { showExitModal: false } })}
          exitQuiz={exitQuiz}
          error={state.error}
          selectAnswer={(answerIndex) => dispatch({ type: 'selectAnswer', answerIndex })}
          previousQuestion={() => dispatch({ type: 'goToPreviousQuestion' })}
          nextQuestion={() => dispatch({ type: 'goToNextQuestion' })}
          submitQuiz={submitQuiz}
          submitting={submitting}
          showAIModal={showAIModal}
          closeAIModal={closeAIModal}
          userQuestion={userQuestion}
          setUserQuestion={setUserQuestion}
          askAI={() =>
            askAI({
              question: currentQuestion.question,
              options: currentQuestion.options,
              questionImage: currentQuestion.questionImage,
              optionImages: currentQuestion.optionImages,
            })
          }
          loadingAI={loadingAI}
          aiError={aiError}
          aiExplanation={aiExplanation}
          showSubmitConfirm={showSubmitConfirm}
          setShowSubmitConfirm={setShowSubmitConfirm}
          unansweredCount={unansweredCount}
          completeSubmit={completeSubmit}
          t={t}
        />
      )}
    </>
  );
}
