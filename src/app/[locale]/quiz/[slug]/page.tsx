'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  HiOutlineLightBulb,
  HiOutlineArrowLeft,
  HiOutlineUser,
  HiOutlineMail,
  HiOutlineExclamationCircle,
  HiOutlineClock,
  HiOutlineDocumentText,
  HiOutlineLightningBolt,
  HiOutlineChatAlt,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineRefresh
} from '@/components/icons';
import { DynamicMarkdownRenderer as MarkdownRenderer } from '@/components/ui/DynamicMarkdownRenderer';
import { QuestionImage, OptionImage } from '@/components/ui/ImageDisplay';
import { QuestionDiscussion } from '@/components/ui/QuestionDiscussion';
import ReportQuiz from '@/components/ui/ReportQuiz';
import { PremiumRequiredModal } from '@/components/ui/PremiumRequiredModal';
import { MobileQuizPlayer } from '@/components/quiz/MobileQuizPlayer';
import { IQuiz } from '@/types';
import { streamQuizAI } from '@/lib/quiz/ask-ai';
import { fetchApiSuccess } from '@/lib/api/client';

interface QuizPlayerPageProps {
  params: { slug: string };
}

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
      }))
    );

    questionIndexMap[questionIndex] = item.originalIndex;

    const shuffledOptions = optionsWithIndex.map(optionItem => optionItem.option);
    const optionIndexMap = optionsWithIndex.map(optionItem => optionItem.originalIndex);
    const optionImages = question.optionImages
      ? optionsWithIndex.map(optionItem => question.optionImages?.[optionItem.originalIndex])
      : undefined;

    log(`\n=== Processing Question ${questionIndex + 1} (originally Q${item.originalIndex + 1}) ===`);
    log('Original options:', question.options);
    log('Final shuffled options:', shuffledOptions);
    log('Option index map (new -> original):', optionIndexMap);
    log(
      'Was actually shuffled:',
      !question.options.every((option, index) => option === shuffledOptions[index])
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

  const initialAnswers: QuizAnswer[] = questions.map(question => (
    question.type === 'multiple' ? [] : -1
  ));

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

function mapAnswersToOriginalOrder(quiz: QuizPlayerQuiz, answers: QuizAnswer[], log: (...args: unknown[]) => void) {
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

    answer.forEach(answerIndex => {
      if (typeof answerIndex !== 'number' || answerIndex < 0 || answerIndex >= optionIndexMap.length) {
        throw new Error(`Invalid answer for question ${index + 1}`);
      }
    });

    return answer.map(answerIndex => optionIndexMap[answerIndex]);
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

const DEBUG_QUIZ_FLOW = process.env.NODE_ENV !== 'production' && false;
const debugLog = (...args: unknown[]) => {
  if (DEBUG_QUIZ_FLOW) {
    console.log(...args);
  }
};

export default function QuizPlayerPage({ params }: QuizPlayerPageProps) {
  const t = useTranslations('quiz');
  const { data: session } = useSession();
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuizPlayerQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<QuizAnswer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [unansweredCount, setUnansweredCount] = useState(0);

  // Mobile detection state
  const [isMobile, setIsMobile] = useState(false);

  // Ask AI states
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiExplanation, setAIExplanation] = useState('');
  const [userQuestion, setUserQuestion] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAIError] = useState('');

  // Exit quiz states
  const [showExitModal, setShowExitModal] = useState(false);

  // Discussion states
  const [isDiscussionCollapsed, setIsDiscussionCollapsed] = useState(true);
  const [showMobileDiscussion, setShowMobileDiscussion] = useState(false);



  // Premium required modal
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // If user is logged in, skip email input
  useEffect(() => {
    if (session?.user?.email) {
      setUserEmail(session.user.email);
      setShowEmailInput(false);
    }
  }, [session]);

  const fetchQuiz = useCallback(async () => {
    try {
      const data = await fetchApiSuccess<IQuiz>(`/api/quiz/${params.slug}/play`);
      const { quiz: nextQuiz, initialAnswers } = createQuizPlayerData(data.data, debugLog);
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
  }, [params.slug]);

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
        newAnswers[currentQuestionIndex] = currentAnswers.filter(a => a !== answerIndex);
      } else {
        // Add answer
        newAnswers[currentQuestionIndex] = [...currentAnswers, answerIndex].sort();
      }
    }
    setUserAnswers(newAnswers);
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < quiz!.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const submitQuizAnswers = useCallback(async (answersToSubmit: QuizAnswer[]) => {
    if (!quiz) return;

    const payload = {
      answers: mapAnswersToOriginalOrder(quiz, answersToSubmit, debugLog),
      userEmail: session?.user?.email || userEmail.trim(),
    };

    debugLog('payload:', payload);

    const data = await fetchApiSuccess<{ attemptId: string; score: number }>(`/api/quiz/${params.slug}/attempt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    router.push(`/quiz/${params.slug}/result?attemptId=${data.data.attemptId}&score=${data.data.score}`);
  }, [params.slug, quiz, router, session?.user?.email, userEmail]);

  // Handle quiz completion for mobile
  const handleQuizComplete = useCallback(async (answers: QuizAnswer[]) => {
    setSubmitting(true);
    try {
      await submitQuizAnswers(answers);
    } catch (error) {
      console.error('Quiz submission error:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  }, [submitQuizAnswers]);

  const completeSubmit = async () => {
    if (!quiz) return;

    setSubmitting(true);
    try {
      await submitQuizAnswers(userAnswers);
    } catch (error) {
      console.error('Quiz submission error:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const submitQuiz = async () => {
    if (!quiz) return;

    const unanswered = userAnswers.filter((answer, index) => {
      const question = quiz.questions[index];
      return !isQuestionAnswered(question, answer);
    }).length;

    if (unanswered > 0) {
      setUnansweredCount(unanswered);
      setShowSubmitConfirm(true);
      return;
    }

    await completeSubmit();
  };

  const askAI = async () => {
    if (!quiz) return;

    setLoadingAI(true);
    setAIError('');
    setAIExplanation('');

    try {
      const currentQuestion = quiz.questions[currentQuestionIndex];
      const explanation = await streamQuizAI({
        question: currentQuestion.question,
        options: currentQuestion.options,
        userQuestion: userQuestion.trim() || undefined,
        questionImage: currentQuestion.questionImage,
        optionImages: currentQuestion.optionImages,
      }, {
        onContent: (_, fullContent) => {
          setAIExplanation(fullContent);
        },
      });

      setAIExplanation(explanation);
    } catch (error: any) {
      setAIError(error.message || 'Failed to connect to AI service');
    } finally {
      setLoadingAI(false);
    }
  };

  const openAIModal = () => {
    setShowAIModal(true);
    setUserQuestion('');
    setAIExplanation('');
    setAIError('');
  };

  const closeAIModal = () => {
    setShowAIModal(false);
  };

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
            <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-violet-500/10 to-purple-600/10 rounded-2xl mb-6">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-600 border-t-transparent"></div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('loadingQuiz')}</h2>
            <p className="text-gray-600">{t('preparingQuiz')}</p>
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
          <Card variant="glass" className="max-w-md w-full backdrop-blur-xl border-white/30 shadow-xl">
            <CardHeader className="text-center">
              <div className="inline-flex items-center justify-center p-3 bg-red-100 rounded-2xl mb-4 mx-auto w-fit">
                <HiOutlineExclamationCircle className="w-6 h-6 text-red-600" />
              </div>
              <CardTitle className="text-red-600 text-xl">{t('quizNotFound')}</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-6">{error}</p>
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
          <Card variant="glass" className="max-w-md w-full backdrop-blur-xl border-white/30 shadow-xl">
            <CardHeader className="text-center">
              <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-violet-500/10 to-purple-600/10 rounded-2xl mb-4 mx-auto w-fit">
                <HiOutlineDocumentText className="w-6 h-6 text-violet-600" />
              </div>
              <CardTitle className="text-2xl gradient-text mb-2">{t('quizAccess')}</CardTitle>
              <p className="text-gray-600">{t('loadingQuizInfo')}</p>
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
          <Card variant="glass" className="max-w-lg w-full backdrop-blur-xl border-white/30 shadow-xl animate-fadeInUp">
            <CardHeader className="text-center">
              <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-violet-500/10 to-purple-600/10 rounded-2xl mb-4 mx-auto w-fit">
                <HiOutlineDocumentText className="w-6 h-6 text-violet-600" />
              </div>
              <CardTitle className="text-2xl gradient-text mb-2">{quiz.title}</CardTitle>
              {quiz.description && (
                <p className="text-gray-600">{quiz.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Quiz Info */}
                <div className="flex justify-center space-x-8 py-4 bg-gray-50/50 rounded-xl">
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
                <Card variant="bordered" className="border-blue-200 bg-blue-50 p-4">
                  <div className="text-center text-blue-700">
                    <HiOutlineLightBulb className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                    <p className="text-sm font-medium">
                      <Link href="/login" className="underline hover:text-blue-800">{t('login')}</Link> {t('loginToTrack')}
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
                    variant="glass"
                    icon={
                      <HiOutlineMail className="w-5 h-5" />
                    }
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    {t('weWillUseEmail')}
                  </p>
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
                    <Link href={`/quiz/${params.slug}/flashcards`}>
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

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const progress = Math.round(((currentQuestionIndex + 1) / quiz.questions.length) * 100);
  const answeredQuestions = userAnswers.filter((answer, index) => {
    const question = quiz.questions[index];
    return isQuestionAnswered(question, answer);
  }).length;

  // Show MobileQuizPlayer on mobile devices
  if (isMobile && !showEmailInput) {
    // Convert Record<string, number | number[]> to (number | number[])[] for handleQuizComplete
    const handleMobileComplete = (answers: Record<string, number | number[]>) => {
      const orderedAnswers: (number | number[])[] = quiz.questions.map((q: any) => {
        const answer = answers[q._id];
        return answer !== undefined ? answer : -1;
      });
      handleQuizComplete(orderedAnswers);
    };

    // Map questions to include _id for MobileQuizPlayer
    const questionsWithId = quiz.questions.map((q: any, idx: number) => ({
      _id: q._id || `q-${idx}`,
      question: q.question,
      options: q.options,
      type: q.type,
      questionImage: q.questionImage,
    }));

    return (
      <MobileQuizPlayer
        questions={questionsWithId}
        onComplete={handleMobileComplete}
        onExit={() => router.push('/')}
      />
    );
  }

  return (
    <div className="min-h-screen">
      {/* Quiz Header - Full screen experience without navigation */}
      <div className="border-b border-gray-200/50 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={openExitModal}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              >
                <HiOutlineArrowLeft className="w-4 h-4 mr-2" />
                {t('exitQuiz')}
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{quiz.title}</h1>
                <p className="text-sm">
                  {session?.user?.email ? (
                    <Badge variant="success" className="text-xs">
                      <HiOutlineUser className="w-3 h-3 mr-1" />
                      {session.user.email}
                    </Badge>
                  ) : (
                    <Badge variant="default" className="text-xs">
                      <HiOutlineMail className="w-3 h-3 mr-1" />
                      {userEmail}
                    </Badge>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <ReportQuiz quizSlug={params.slug} quizTitle={quiz.title} />
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-700">
                  {t('question')} {currentQuestionIndex + 1} {t('of', { ns: 'common' })} {quiz.questions.length}
                </div>
                <div className="text-xs text-gray-500">
                  {answeredQuestions} {t('of', { ns: 'common' })} {quiz.questions.length} {t('answered')}
                </div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
              <span>{t('progress')}</span>
              <span>{progress}% {t('complete')}</span>
            </div>
            <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-violet-500 to-purple-600 h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Question with Discussion Panel */}
      <main className={`${isDiscussionCollapsed ? 'max-w-4xl' : 'max-w-7xl'} mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all duration-300`}>
        <div className="flex">
          {/* Question Card */}
          <div className={`flex-1 ${!isDiscussionCollapsed ? 'pr-6' : ''}`}>
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-xl">
                      {currentQuestion.question}
                    </CardTitle>

                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="outline"
                      onClick={openAIModal}
                      className="text-purple-600 border-purple-200 hover:bg-purple-50 hover:border-purple-300"
                    >
                      {t('askRinChan')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        // On desktop, toggle the discussion panel
                        if (window.innerWidth >= 768) {
                          setIsDiscussionCollapsed(!isDiscussionCollapsed);
                        } else {
                          // On mobile, show the modal
                          setShowMobileDiscussion(true);
                        }
                      }}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                      title={t('discussion')}
                    >
                      {t('discussion')}
                    </Button>
                  </div>
                </div>

                {/* Display question image if exists */}
                {currentQuestion.questionImage && (
                  <div className="mt-4">
                    <QuestionImage
                      src={currentQuestion.questionImage}
                      alt={`Question ${currentQuestionIndex + 1} image`}
                    />
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {currentQuestion.options.map((option, index) => {
                    const currentAnswer = userAnswers[currentQuestionIndex];
                    let isSelected = false;

                    if (currentQuestion.type === 'single') {
                      isSelected = currentAnswer === index;
                    } else {
                      // For multiple choice, ensure we have an array
                      isSelected = Array.isArray(currentAnswer) && currentAnswer.includes(index);
                    }

                    return (
                      <label
                        key={index}
                        className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition-colors ${isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <input
                          type={currentQuestion.type === 'single' ? 'radio' : 'checkbox'}
                          name={`question-${currentQuestionIndex}`}
                          value={index}
                          checked={isSelected}
                          onChange={() => selectAnswer(index)}
                          className="sr-only"
                        />
                        <div className={`w-4 h-4 mr-3 flex items-center justify-center border-2 ${currentQuestion.type === 'single' ? 'rounded-full' : 'rounded'
                          } ${isSelected
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                          }`}>
                          {isSelected && (
                            currentQuestion.type === 'single' ? (
                              <div className="w-2 h-2 rounded-full bg-white"></div>
                            ) : (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )
                          )}
                        </div>
                        <div className="flex-1">
                          <span className="text-gray-900">{option}</span>

                          {/* Display option image if exists */}
                          {currentQuestion.optionImages?.[index] && (
                            <div className="mt-2">
                              <OptionImage
                                src={currentQuestion.optionImages[index]!}
                                alt={`Option ${String.fromCharCode(65 + index)} image`}
                              />
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>

                {error && (
                  <div className="mt-4 rounded-md bg-red-50 p-3">
                    <div className="text-sm text-red-700">{error}</div>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between items-center mt-8">
                  <Button
                    variant="outline"
                    onClick={previousQuestion}
                    disabled={currentQuestionIndex === 0}
                  >
                    {t('previous')}
                  </Button>

                  <div className="text-sm text-gray-600">
                    {currentQuestionIndex + 1} / {quiz.questions.length}
                  </div>

                  {currentQuestionIndex === quiz.questions.length - 1 ? (
                    <Button
                      onClick={submitQuiz}
                      loading={submitting}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {t('submitQuiz')}
                    </Button>
                  ) : (
                    <Button
                      onClick={nextQuestion}
                      disabled={currentQuestionIndex === quiz.questions.length - 1}
                    >
                      {t('next')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Question overview */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">{t('questionOverview')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-10 gap-2">
                  {quiz.questions.map((question, index) => {
                    let isAnswered = false;
                    const answer = userAnswers[index];

                    if (question.type === 'single') {
                      isAnswered = answer !== -1;
                    } else {
                      isAnswered = Array.isArray(answer) && answer.length > 0;
                    }

                    return (
                      <button
                        key={index}
                        onClick={() => setCurrentQuestionIndex(index)}
                        className={`w-8 h-8 rounded text-xs font-medium transition-colors ${index === currentQuestionIndex
                          ? 'bg-blue-600 text-white'
                          : isAnswered
                            ? 'bg-green-100 text-green-800 border border-green-300'
                            : 'bg-gray-100 text-gray-600 border border-gray-300'
                          }`}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center space-x-6 text-xs">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-600 rounded mr-2"></div>
                    <span>{t('current')}</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-100 border border-green-300 rounded mr-2"></div>
                    <span>{t('answered')}</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded mr-2"></div>
                    <span>{t('notAnswered')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Discussion Panel */}
          <QuestionDiscussion
            quizSlug={params.slug}
            questionIndex={currentQuestionIndex}
            isCollapsed={isDiscussionCollapsed}
            onToggleCollapse={() => setIsDiscussionCollapsed(!isDiscussionCollapsed)}
          />
        </div>

        {/* Mobile Discussion Modal */}
        <Modal
          isOpen={showMobileDiscussion}
          onClose={() => setShowMobileDiscussion(false)}
          title={`💬 ${t('discussion')}`}
          size="large"
          className="md:hidden"
        >
          <div className="h-96">
            <QuestionDiscussion
              quizSlug={params.slug}
              questionIndex={currentQuestionIndex}
              isCollapsed={false}
              onToggleCollapse={() => setShowMobileDiscussion(false)}
              isMobile={true}
            />
          </div>
        </Modal>

        {/* Exit Quiz Modal */}
        <Modal
          isOpen={showExitModal}
          onClose={closeExitModal}
          title={`⚠️ ${t('exitQuiz')}`}
          size="small"
        >
          <div className="space-y-4">
            <p className="text-gray-700">
              {t('exitQuizWarning')}
            </p>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">{t('exitWarning')}</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    {t('exitWarningMessage', { answered: answeredQuestions, total: quiz.questions.length })}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={closeExitModal}
                className="flex-1"
              >
                {t('continueQuiz')}
              </Button>
              <Button
                onClick={exitQuiz}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {t('exitQuiz')}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Ask AI Modal */}
        <Modal
          isOpen={showAIModal}
          onClose={closeAIModal}
          title={t('askRinChan')}
          size="wide"
        >
          <div className="space-y-4">
            {/* Current Question Display */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">{t('currentQuestion')}</h4>
              <p className="text-sm text-gray-700">{quiz && currentQuestion.question}</p>
              <div className="mt-2 space-y-1">
                {quiz && currentQuestion.options.map((option, index) => (
                  <div key={index} className="text-xs text-gray-600 flex items-start space-x-2">
                    <span>{String.fromCharCode(65 + index)}. {option}</span>
                    {currentQuestion.optionImages?.[index] && (
                      <OptionImage src={currentQuestion.optionImages[index]!} alt={`Option ${index} image`} className="ml-1" />
                    )}
                  </div>
                ))}
              </div>
              {currentQuestion.questionImage && (
                <div className="mt-3">
                  <QuestionImage src={currentQuestion.questionImage} alt="Question img" />
                </div>
              )}
            </div>

            {/* User Question Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('askSpecificQuestion')}
              </label>
              <Input
                value={userQuestion}
                onChange={(e) => setUserQuestion(e.target.value)}
                placeholder={t('questionPlaceholder')}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('leaveEmptyGeneral')}
              </p>
            </div>

            {/* Ask Button */}
            <Button
              onClick={askAI}
              loading={loadingAI}
              disabled={loadingAI}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              {loadingAI ? t('gettingExplanation') : t('getRinChanExplanation')}
            </Button>

            {/* AI Response */}
            {aiError && (
              <div className="rounded-md bg-red-50 p-3">
                <div className="text-sm text-red-700">{aiError}</div>
              </div>
            )}

            {aiExplanation && (
              <div className="rounded-md bg-green-50 p-4">
                <h4 className="font-medium text-green-900 mb-3">{t('aiExplanation')}</h4>
                <MarkdownRenderer
                  content={aiExplanation}
                  className="text-green-800"
                />
              </div>
            )}

            {/* Disclaimer */}
            <div className="text-xs text-gray-500 bg-yellow-50 p-3 rounded-md">
              {t('aiNote')}
            </div>
          </div>
        </Modal>

        <ConfirmModal
          isOpen={showSubmitConfirm}
          title={`${t('submitQuiz')}?`}
          message={t('unansweredWarning', { count: unansweredCount })}
          confirmText={t('submit', { ns: 'common' })}
          onCancel={() => setShowSubmitConfirm(false)}
          onConfirm={async () => {
            setShowSubmitConfirm(false);
            await completeSubmit();
          }}
        />
      </main>
    </div>
  );
} 
