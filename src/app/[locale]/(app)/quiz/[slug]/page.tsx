'use client';

import { useState, useEffect, useCallback } from 'react';
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

export default function QuizPlayerPage() {
  const t = useTranslations('quiz');
  const { data: session } = useSession();
  const router = useRouter();
  const slug = useRequiredRouteParam('slug');
  const encodedSlug = routePathSegment(slug);
  const [quiz, setQuiz] = useState<QuizPlayerQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<QuizAnswer[]>([]);

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

  // Exit quiz states
  const [showExitModal, setShowExitModal] = useState(false);

  // Discussion states
  const [isDiscussionCollapsed, setIsDiscussionCollapsed] = useState(true);
  const [showMobileDiscussion, setShowMobileDiscussion] = useState(false);

  // Premium required modal
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  // If user is logged in, skip email input
  useEffect(() => {
    if (session?.user?.email) {
      setUserEmail(session.user.email);
      setShowEmailInput(false);
    }
  }, [session]);

  const fetchQuiz = useCallback(async () => {
    try {
      const data = await fetchApiData<IQuiz>(`/api/quiz/${encodedSlug}/play`);
      const { quiz: nextQuiz, initialAnswers } = createQuizPlayerData(data, debugLog);
      setQuiz(nextQuiz);
      setUserAnswers(initialAnswers);
    } catch (error: any) {
      if (error.message === 'Premium subscription required to access private quizzes') {
        setShowPremiumModal(true);
      } else {
        setError(error.message || 'Quiz not found');
      }
    } finally {
      setLoading(false);
    }
  }, [encodedSlug]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  const startQuiz = () => {
    if (!session?.user?.email && !userEmail.trim()) {
      setError('Please enter your email to start the quiz');
      return;
    }
    setShowEmailInput(false);
    setError('');
  };

  const selectAnswer = (answerIndex: number) => {
    if (!quiz) return;

    const currentQuestion = quiz.questions[currentQuestionIndex];
    const newAnswers = [...userAnswers];

    if (currentQuestion.type === 'single') {
      // Single choice: replace answer
      newAnswers[currentQuestionIndex] = answerIndex;
    } else {
      // Multiple choice: toggle answer in array
      let currentAnswers = newAnswers[currentQuestionIndex];

      // Ensure currentAnswers is an array for multiple choice
      if (!Array.isArray(currentAnswers)) {
        currentAnswers = [];
      }

      const answerExists = currentAnswers.includes(answerIndex);

      if (answerExists) {
        // Remove answer
        newAnswers[currentQuestionIndex] = currentAnswers.filter((a) => a !== answerIndex);
      } else {
        // Add answer
        newAnswers[currentQuestionIndex] = [...currentAnswers, answerIndex].sort();
      }
    }
    setUserAnswers(newAnswers);
  };

  const nextQuestion = () => {
    if (quiz && currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

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
    userAnswers,
    userEmail,
    sessionEmail: session?.user?.email || undefined,
    onSubmitSuccess: (attemptId, score) => {
      router.push(`/quiz/${encodedSlug}/result?attemptId=${attemptId}&score=${score}`);
    },
    onSubmitStart: () => setError(''),
    onSubmitError: (message) => setError(message),
    mapAnswersToOriginalOrder: (currentQuiz, answersToSubmit) =>
      mapAnswersToOriginalOrder(currentQuiz, answersToSubmit, debugLog),
    isQuestionAnswered,
  });

  // Exit quiz functions
  const openExitModal = () => {
    setShowExitModal(true);
  };

  const closeExitModal = () => {
    setShowExitModal(false);
  };

  const exitQuiz = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navigation />
        <div className="flex items-center justify-center min-h-[70vh]">
          <div className="text-center">
            <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-green-500/10 to-brand-trust/10 rounded-2xl mb-6">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
            </div>
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">{t('loadingQuiz')}</h2>
            <p className="text-neutral-600">{t('preparingQuiz')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !quiz && !showPremiumModal) {
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
                <HiOutlineExclamationCircle className="w-6 h-6 text-red-600" />
              </div>
              <CardTitle className="text-red-600 text-xl">{t('quizNotFound')}</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-neutral-600 mb-6">{error}</p>
              <Link href="/">
                <Button variant="gradient" className="w-full">
                  <HiOutlineArrowLeft className="w-4 h-4 mr-2" />
                  {t('returnHome')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show basic layout with premium modal when premium is required
  if (showPremiumModal) {
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
                <HiOutlineDocumentText className="w-6 h-6 text-brand-trust" />
              </div>
              <CardTitle className="text-2xl text-neutral-900 mb-2">{t('quizAccess')}</CardTitle>
              <p className="text-neutral-600">{t('loadingQuizInfo')}</p>
            </CardHeader>
          </Card>
        </div>

        {/* Premium Required Modal */}
        <PremiumRequiredModal
          isOpen={showPremiumModal}
          onClose={() => setShowPremiumModal(false)}
        />
      </div>
    );
  }

  // Email input screen (only for non-logged in users)
  if (showEmailInput && !session?.user?.email && quiz) {
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
                <HiOutlineDocumentText className="w-6 h-6 text-brand-trust" />
              </div>
              <CardTitle className="text-2xl text-neutral-900 mb-2">{quiz.title}</CardTitle>
              {quiz.description && <p className="text-neutral-600">{quiz.description}</p>}
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Quiz Info */}
                <div className="flex justify-center space-x-8 py-4 bg-neutral-50/50 rounded-xl">
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
                      <HiOutlineExclamationCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                      <span className="text-sm font-medium">{error}</span>
                    </div>
                  </Card>
                )}

                {/* Login Suggestion */}
                <Card variant="bordered" className="border-green-200 bg-green-50 p-4">
                  <div className="text-center text-brand-trust">
                    <HiOutlineLightBulb className="w-6 h-6 mx-auto mb-2 text-brand-trust" />
                    <p className="text-sm font-medium">
                      <Link href="/login" className="underline hover:text-green-700">
                        {t('login')}
                      </Link>{' '}
                      {t('loginToTrack')}
                    </p>
                  </div>
                </Card>

                {/* Email Input */}
                <div>
                  <Input
                    label={t('yourEmail')}
                    id="email"
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder={t('enterEmailAddress')}
                    required
                    icon={<HiOutlineMail className="w-5 h-5" />}
                  />
                  <p className="mt-2 text-xs text-neutral-500">{t('weWillUseEmail')}</p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button onClick={startQuiz} variant="gradient" size="lg" className="w-full">
                    <HiOutlineLightningBolt className="w-5 h-5 mr-2" />
                    {t('startQuiz')}
                  </Button>

                  <div className="grid grid-cols-2 gap-3">
                    <Link href="/">
                      <Button variant="outline" className="w-full">
                        <HiOutlineArrowLeft className="w-4 h-4 mr-2" />
                        {t('backHome')}
                      </Button>
                    </Link>
                    <Link href={`/quiz/${encodedSlug}/flashcards`}>
                      <Button variant="accent" className="w-full">
                        <HiOutlineRefresh className="w-4 h-4 mr-2" />
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

  // Quiz interface
  if (!quiz) return null;

  // Extract author name safely (can be string or IUser object)
  const authorName =
    typeof quiz.author === 'string'
      ? quiz.author
      : getUserDisplayName(quiz.author as any) || 'RinKuzu Community';
  const categoryName =
    typeof quiz.category === 'string' ? quiz.category : (quiz.category as any)?.name || undefined;

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const progress = Math.round(((currentQuestionIndex + 1) / quiz.questions.length) * 100);
  const answeredQuestions = userAnswers.filter((answer, index) => {
    const question = quiz.questions[index];
    return isQuestionAnswered(question, answer);
  }).length;

  return (
    <>
      {/* Quiz schema for SEO — SoftwareApplication + Course */}
      <QuizPageSchema
        quizSlug={slug}
        quizTitle={quiz.title}
        quizDescription={quiz.description}
        authorName={authorName}
        categoryName={categoryName}
        questionCount={quiz.questions.length}
      />

      {/* Mobile Quiz Layout */}
      {isMobile && !showEmailInput && (
        <MobileQuizLayout
          quiz={quiz}
          onComplete={handleQuizComplete}
          onExit={() => router.push('/')}
          submitting={submitting}
          error={error}
        />
      )}

      {!isMobile && (
        <DesktopQuizLayout
          slug={slug}
          quizTitle={quiz.title}
          questions={quiz.questions}
          sessionEmail={session?.user?.email}
          userEmail={userEmail}
          currentQuestionIndex={currentQuestionIndex}
          setCurrentQuestionIndex={setCurrentQuestionIndex}
          answeredQuestions={answeredQuestions}
          progress={progress}
          currentQuestion={currentQuestion}
          userAnswers={userAnswers}
          isDiscussionCollapsed={isDiscussionCollapsed}
          setIsDiscussionCollapsed={setIsDiscussionCollapsed}
          openAIModal={openAIModal}
          showMobileDiscussion={showMobileDiscussion}
          setShowMobileDiscussion={setShowMobileDiscussion}
          showExitModal={showExitModal}
          openExitModal={openExitModal}
          closeExitModal={closeExitModal}
          exitQuiz={exitQuiz}
          error={error}
          selectAnswer={selectAnswer}
          previousQuestion={previousQuestion}
          nextQuestion={nextQuestion}
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
