'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui/Card';
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
import { useQuizStore } from '@/store/useQuizStore';
import { IQuiz } from '@/types';

interface QuizPlayerPageProps {
  params: { slug: string };
}

export default function QuizPlayerPage({ params }: QuizPlayerPageProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [quiz, setQuiz] = useState<IQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(number | number[])[]>([]);
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    fetchQuiz();
  }, [params.slug]);

  const fetchQuiz = async () => {
    try {
      const response = await fetch(`/api/quiz/${params.slug}/play`);
      const data = await response.json();

      if (data.success) {
        // Fisher-Yates shuffle function
        function shuffleArray<T>(array: T[]): T[] {
          const shuffled = [...array];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          return shuffled;
        }

        console.log('\n=== SHUFFLING QUIZ ===');
        console.log('Original questions count:', data.data.questions.length);

        // First, shuffle the order of questions
        const questionsWithIndex = data.data.questions.map((question: any, index: number) => ({
          question,
          originalIndex: index
        }));

        const shuffledQuestionsWithIndex = shuffleArray(questionsWithIndex);
        console.log('Questions shuffled order:');
        shuffledQuestionsWithIndex.forEach((item: any, newIndex: number) => {
          console.log(`Position ${newIndex + 1}: Question ${item.originalIndex + 1}`);
        });

        // Create mapping for question order (new position -> original position)
        const questionIndexMap: number[] = [];

        // Then shuffle options within each question
        const shuffledQuestions = shuffledQuestionsWithIndex.map((item: any, questionIndex: number) => {
          const q = item.question;
          questionIndexMap[questionIndex] = item.originalIndex;

          console.log(`\n=== Processing Question ${questionIndex + 1} (originally Q${item.originalIndex + 1}) ===`);
          console.log('Original options:', q.options);

          // Create array of options with their original indices
          const optionsWithIndex = q.options.map((option: string, index: number) => ({
            option,
            originalIndex: index
          }));

          console.log('Options with original indices:', optionsWithIndex);

          // Shuffle the array
          const shuffledOptionsWithIndex = shuffleArray(optionsWithIndex);
          console.log('After shuffle:', shuffledOptionsWithIndex);

          // Extract shuffled options and create mapping
          const shuffledOptions: string[] = [];
          const optionIndexMap: number[] = [];

          for (let newIndex = 0; newIndex < shuffledOptionsWithIndex.length; newIndex++) {
            const item = shuffledOptionsWithIndex[newIndex] as { option: string; originalIndex: number };
            shuffledOptions[newIndex] = item.option;
            optionIndexMap[newIndex] = item.originalIndex;
          }

          console.log('Final shuffled options:', shuffledOptions);
          console.log('Option index map (new -> original):', optionIndexMap);

          // Check if shuffle actually happened
          const isShuffled = !q.options.every((option: string, index: number) => option === shuffledOptions[index]);
          console.log('Was actually shuffled:', isShuffled);

          return {
            ...q,
            options: shuffledOptions,
            optionIndexMap, // Map from new option index to original option index
            originalQuestionIndex: item.originalIndex // Store original question index
          };
        });

        // Validate that all questions have the required mapping data
        const validationErrors = [];
        shuffledQuestions.forEach((q, index) => {
          if (!Array.isArray((q as any).optionIndexMap)) {
            validationErrors.push(`Question ${index + 1}: missing optionIndexMap`);
          }
          if (typeof (q as any).originalQuestionIndex !== 'number') {
            validationErrors.push(`Question ${index + 1}: missing originalQuestionIndex`);
          }
        });

        if (!Array.isArray(questionIndexMap) || questionIndexMap.length !== shuffledQuestions.length) {
          validationErrors.push('Invalid questionIndexMap');
        }

        if (validationErrors.length > 0) {
          console.error('Quiz validation errors:', validationErrors);
          throw new Error('Quiz data validation failed: ' + validationErrors.join(', '));
        }

        setQuiz({
          ...data.data,
          questions: shuffledQuestions,
          questionIndexMap // Map from new question position to original question position
        });

        // Initialize answers based on SHUFFLED question types (not original)
        const initialAnswers = shuffledQuestions.map((q: any, index: number) => {
          console.log(`Shuffled Question ${index}:`, { type: q.type, question: q.question });
          return q.type === 'multiple' ? [] : -1;
        });

        console.log('Initial answers (based on shuffled questions):', initialAnswers);
        console.log('Initial answers with types:', initialAnswers.map((ans: any, idx: number) => ({
          index: idx,
          answer: ans,
          answerType: typeof ans,
          isArray: Array.isArray(ans)
        })));

        setUserAnswers(initialAnswers);
        console.log('\n=== QUIZ LOADED ===');
        console.log('Total questions:', data.data.questions.length);
        console.log('Questions shuffled:', shuffledQuestions.length);
        console.log('Question order mapping:', questionIndexMap);
        console.log('Quiz ready with both question and option shuffling!');
      } else {
        if (data.error === 'Premium subscription required to access private quizzes') {
          setShowPremiumModal(true);
        } else {
          setError(data.error || 'Quiz not found');
        }
      }
    } catch (error) {
      setError('Failed to load quiz');
    } finally {
      setLoading(false);
    }
  };

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

  const submitQuiz = async () => {
    if (!quiz) return;

    const unanswered = userAnswers.filter((answer, index) => {
      const question = quiz.questions[index];
      if (question.type === 'single') {
        return answer === -1;
      } else {
        return !Array.isArray(answer) || answer.length === 0;
      }
    }).length;

    if (unanswered > 0) {
      if (!confirm(`You have ${unanswered} unanswered questions. Submit anyway?`)) {
        return;
      }
    }

    setSubmitting(true);
    try {
      console.log('=== SUBMITTING QUIZ ===');
      console.log('userAnswers:', userAnswers);
      console.log('userAnswers with types:', userAnswers.map((ans: any, idx: number) => ({
        index: idx,
        answer: ans,
        answerType: typeof ans,
        isArray: Array.isArray(ans)
      })));
      console.log('questionIndexMap:', (quiz as any).questionIndexMap);
      console.log('quiz.questions:', quiz.questions.map((q, i) => ({
        currentIndex: i,
        originalQuestionIndex: (q as any).originalQuestionIndex,
        type: q.type,
        optionsCount: q.options.length,
        optionIndexMap: (q as any).optionIndexMap
      })));

      // First convert option indices, then reorder to match original question order
      const convertedAnswers = userAnswers.map((ans, idx) => {
        const question = quiz.questions[idx];
        const mapArr: number[] = (question as any).optionIndexMap;

        // Add validation for optionIndexMap
        if (!mapArr || !Array.isArray(mapArr)) {
          console.error(`Question ${idx}: optionIndexMap is missing or invalid`, {
            optionIndexMap: mapArr,
            question: question
          });
          throw new Error(`Option mapping is missing for question ${idx + 1}`);
        }

        console.log(`Converting question ${idx} (originally Q${(question as any).originalQuestionIndex + 1}):`, {
          userAnswer: ans,
          optionIndexMap: mapArr,
          questionType: question.type
        });

        if (question.type === 'single') {
          const aNum = ans as number;

          // Validate that answer is a number for single choice
          if (typeof aNum !== 'number') {
            console.error(`Single choice question ${idx} has non-number answer:`, {
              answer: ans,
              answerType: typeof ans,
              questionType: question.type
            });
            throw new Error(`Invalid answer type for single choice question ${idx + 1}`);
          }

          if (aNum !== -1 && (aNum < 0 || aNum >= mapArr.length)) {
            console.error(`Invalid answer index ${aNum} for question ${idx}, mapArr length: ${mapArr.length}`);
            throw new Error(`Invalid answer for question ${idx + 1}`);
          }
          const converted = aNum === -1 ? -1 : mapArr[aNum];
          console.log(`Single choice: ${aNum} -> ${converted}`);
          return converted;
        } else {
          // Validate that answer is an array for multiple choice
          if (!Array.isArray(ans)) {
            console.error(`Multiple choice question ${idx} has non-array answer:`, {
              answer: ans,
              answerType: typeof ans,
              questionType: question.type
            });
            throw new Error(`Invalid answer type for multiple choice question ${idx + 1}`);
          }

          const arr = ans as number[];
          for (const a of arr) {
            if (typeof a !== 'number' || a < 0 || a >= mapArr.length) {
              console.error(`Invalid answer index ${a} for question ${idx}, mapArr length: ${mapArr.length}`);
              throw new Error(`Invalid answer for question ${idx + 1}`);
            }
          }
          const converted = arr.map(a => mapArr[a]);
          console.log(`Multiple choice: [${arr}] -> [${converted}]`);
          return converted;
        }
      });

      // Reorder answers to match original question order
      const questionIndexMap: number[] = (quiz as any).questionIndexMap;

      // Add validation for questionIndexMap
      if (!questionIndexMap || !Array.isArray(questionIndexMap)) {
        console.error('questionIndexMap is missing or invalid', {
          questionIndexMap: questionIndexMap,
          quiz: quiz
        });
        throw new Error('Question ordering mapping is missing');
      }

      if (questionIndexMap.length !== convertedAnswers.length) {
        console.error('questionIndexMap length mismatch', {
          questionIndexMapLength: questionIndexMap.length,
          convertedAnswersLength: convertedAnswers.length
        });
        throw new Error('Question mapping length mismatch');
      }

      const originalOrderAnswers: (number | number[])[] = new Array(convertedAnswers.length);

      convertedAnswers.forEach((answer, shuffledIndex) => {
        const originalIndex = questionIndexMap[shuffledIndex];
        if (originalIndex < 0 || originalIndex >= convertedAnswers.length) {
          console.error(`Invalid original index ${originalIndex} for shuffled index ${shuffledIndex}`);
          throw new Error(`Invalid question mapping for question ${shuffledIndex + 1}`);
        }
        originalOrderAnswers[originalIndex] = answer;
      });

      console.log('convertedAnswers (shuffled order):', convertedAnswers);
      console.log('originalOrderAnswers (original question order):', originalOrderAnswers);

      const payload = {
        answers: originalOrderAnswers,
        userEmail: session?.user?.email || userEmail.trim(),
      };

      console.log('payload:', payload);

      const response = await fetch(`/api/quiz/${params.slug}/attempt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/quiz/${params.slug}/result?attemptId=${data.data.attemptId}&score=${data.data.score}`);
      } else {
        setError(data.error || 'Failed to submit quiz');
      }
    } catch (error) {
      console.error('Quiz submission error:', error);

      // Show more specific error message if available
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to submit quiz');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const askAI = async () => {
    if (!quiz) return;

    setLoadingAI(true);
    setAIError('');
    setAIExplanation('');

    try {
      const currentQuestion = quiz.questions[currentQuestionIndex];
      const response = await fetch('/api/quiz/ask-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: currentQuestion.question,
          options: currentQuestion.options,
          userQuestion: userQuestion.trim() || undefined,
          questionImage: currentQuestion.questionImage,
          optionImages: currentQuestion.optionImages,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAIExplanation(data.data.explanation);
      } else {
        setAIError(data.error || 'Failed to get AI explanation');
      }
    } catch (error) {
      setAIError('Failed to connect to AI service');
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Quiz</h2>
            <p className="text-gray-600">Preparing your quiz experience...</p>
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
              <CardTitle className="text-red-600 text-xl">Quiz Not Found</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-6">{error}</p>
              <Link href="/">
                <Button variant="gradient" className="w-full">
                  <HiOutlineArrowLeft className="w-4 h-4 mr-2" />
                  Return Home
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
              <CardTitle className="text-2xl gradient-text mb-2">Quiz Access</CardTitle>
              <p className="text-gray-600">Loading quiz information...</p>
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
                      {quiz.questions.length} Questions
                    </Badge>
                  </div>
                  <div className="text-center">
                    <Badge variant="info" className="mb-1">
                      No Time Limit
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
                      <Link href="/login" className="underline hover:text-blue-800">Login</Link> to track your quiz history or continue as guest below.
                    </p>
                  </div>
                </Card>

                {/* Email Input */}
                <div>
                  <Input
                    label="Your Email"
                    id="email"
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="Enter your email address"
                    required
                    variant="glass"
                    icon={
                      <HiOutlineMail className="w-5 h-5" />
                    }
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    We'll use this to track your quiz attempt
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button onClick={startQuiz} variant="gradient" size="lg" className="w-full">
                    <HiOutlineLightningBolt className="w-5 h-5 mr-2" />
                    Start Quiz
                  </Button>

                  <div className="grid grid-cols-2 gap-3">
                    <Link href="/">
                      <Button variant="outline" className="w-full">
                        <HiOutlineArrowLeft className="w-4 h-4 mr-2" />
                        Back Home
                      </Button>
                    </Link>
                    <Link href={`/quiz/${params.slug}/flashcards`}>
                      <Button variant="accent" className="w-full">
                        <HiOutlineRefresh className="w-4 h-4 mr-2" />
                        Flashcards
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
    if (question.type === 'single') {
      return answer !== -1;
    } else {
      return Array.isArray(answer) && answer.length > 0;
    }
  }).length;

  // Handle quiz completion for mobile
  const handleQuizComplete = async (answers: (number | number[])[]) => {
    setSubmitting(true);
    try {
      console.log('=== SUBMITTING QUIZ (Mobile) ===');
      console.log('userAnswers:', answers);
      console.log('userAnswers with types:', answers.map((ans: any, idx: number) => ({
        index: idx,
        answer: ans,
        answerType: typeof ans,
        isArray: Array.isArray(ans)
      })));
      console.log('questionIndexMap:', (quiz as any).questionIndexMap);
      console.log('quiz.questions:', quiz.questions.map((q, i) => ({
        currentIndex: i,
        originalQuestionIndex: (q as any).originalQuestionIndex,
        type: q.type,
        optionsCount: q.options.length,
        optionIndexMap: (q as any).optionIndexMap
      })));

      // First convert option indices, then reorder to match original question order
      const convertedAnswers = answers.map((ans, idx) => {
        const question = quiz.questions[idx];
        const mapArr: number[] = (question as any).optionIndexMap;

        // Add validation for optionIndexMap
        if (!mapArr || !Array.isArray(mapArr)) {
          console.error(`Question ${idx}: optionIndexMap is missing or invalid`, {
            optionIndexMap: mapArr,
            question: question
          });
          throw new Error(`Option mapping is missing for question ${idx + 1}`);
        }

        console.log(`Converting question ${idx} (originally Q${(question as any).originalQuestionIndex + 1}):`, {
          userAnswer: ans,
          optionIndexMap: mapArr,
          questionType: question.type
        });

        if (question.type === 'single') {
          const aNum = ans as number;

          // Validate that answer is a number for single choice
          if (typeof aNum !== 'number') {
            console.error(`Single choice question ${idx} has non-number answer:`, {
              answer: ans,
              answerType: typeof ans,
              questionType: question.type
            });
            throw new Error(`Invalid answer type for single choice question ${idx + 1}`);
          }

          if (aNum !== -1 && (aNum < 0 || aNum >= mapArr.length)) {
            console.error(`Invalid answer index ${aNum} for question ${idx}, mapArr length: ${mapArr.length}`);
            throw new Error(`Invalid answer for question ${idx + 1}`);
          }
          const converted = aNum === -1 ? -1 : mapArr[aNum];
          console.log(`Single choice: ${aNum} -> ${converted}`);
          return converted;
        } else {
          // Validate that answer is an array for multiple choice
          if (!Array.isArray(ans)) {
            console.error(`Multiple choice question ${idx} has non-array answer:`, {
              answer: ans,
              answerType: typeof ans,
              questionType: question.type
            });
            throw new Error(`Invalid answer type for multiple choice question ${idx + 1}`);
          }

          const arr = ans as number[];
          for (const a of arr) {
            if (typeof a !== 'number' || a < 0 || a >= mapArr.length) {
              console.error(`Invalid answer index ${a} for question ${idx}, mapArr length: ${mapArr.length}`);
              throw new Error(`Invalid answer for question ${idx + 1}`);
            }
          }
          const converted = arr.map(a => mapArr[a]);
          console.log(`Multiple choice: [${arr}] -> [${converted}]`);
          return converted;
        }
      });

      // Reorder answers to match original question order
      const questionIndexMap: number[] = (quiz as any).questionIndexMap;

      // Add validation for questionIndexMap
      if (!questionIndexMap || !Array.isArray(questionIndexMap)) {
        console.error('questionIndexMap is missing or invalid', {
          questionIndexMap: questionIndexMap,
          quiz: quiz
        });
        throw new Error('Question ordering mapping is missing');
      }

      if (questionIndexMap.length !== convertedAnswers.length) {
        console.error('questionIndexMap length mismatch', {
          questionIndexMapLength: questionIndexMap.length,
          convertedAnswersLength: convertedAnswers.length
        });
        throw new Error('Question mapping length mismatch');
      }

      const originalOrderAnswers: (number | number[])[] = new Array(convertedAnswers.length);

      convertedAnswers.forEach((answer, shuffledIndex) => {
        const originalIndex = questionIndexMap[shuffledIndex];
        if (originalIndex < 0 || originalIndex >= convertedAnswers.length) {
          console.error(`Invalid original index ${originalIndex} for shuffled index ${shuffledIndex}`);
          throw new Error(`Invalid question mapping for question ${shuffledIndex + 1}`);
        }
        originalOrderAnswers[originalIndex] = answer;
      });

      console.log('convertedAnswers (shuffled order):', convertedAnswers);
      console.log('originalOrderAnswers (original question order):', originalOrderAnswers);

      const payload = {
        answers: originalOrderAnswers,
        userEmail: session?.user?.email || userEmail.trim(),
      };

      console.log('payload:', payload);

      const response = await fetch(`/api/quiz/${params.slug}/attempt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/quiz/${params.slug}/result?attemptId=${data.data.attemptId}&score=${data.data.score}`);
      } else {
        setError(data.error || 'Failed to submit quiz');
      }
    } catch (error) {
      console.error('Quiz submission error:', error);

      // Show more specific error message if available
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to submit quiz');
      }
    } finally {
      setSubmitting(false);
    }
  };

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
                Exit Quiz
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
                  Question {currentQuestionIndex + 1} of {quiz.questions.length}
                </div>
                <div className="text-xs text-gray-500">
                  {answeredQuestions} of {quiz.questions.length} answered
                </div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
              <span>Progress</span>
              <span>{progress}% Complete</span>
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
                      Ask Rin-chan
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
                      title="Discussion"
                    >
                      Discussion
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
                    Previous
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
                      Submit Quiz
                    </Button>
                  ) : (
                    <Button
                      onClick={nextQuestion}
                      disabled={currentQuestionIndex === quiz.questions.length - 1}
                    >
                      Next
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Question overview */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">Question Overview</CardTitle>
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
                    <span>Current</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-100 border border-green-300 rounded mr-2"></div>
                    <span>Answered</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded mr-2"></div>
                    <span>Not answered</span>
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
          title="💬 Discussion"
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
          title="⚠️ Exit Quiz"
          size="small"
        >
          <div className="space-y-4">
            <p className="text-gray-700">
              Are you sure you want to exit this quiz? Your progress will not be saved and you'll need to start over.
            </p>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">Warning</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    You have answered {answeredQuestions} out of {quiz.questions.length} questions. This progress will be lost if you exit.
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
                Continue Quiz
              </Button>
              <Button
                onClick={exitQuiz}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Exit Quiz
              </Button>
            </div>
          </div>
        </Modal>

        {/* Ask AI Modal */}
        <Modal
          isOpen={showAIModal}
          onClose={closeAIModal}
          title="Ask Rin-chan about this question"
          size="wide"
        >
          <div className="space-y-4">
            {/* Current Question Display */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Current Question:</h4>
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
                Ask a specific question (optional):
              </label>
              <Input
                value={userQuestion}
                onChange={(e) => setUserQuestion(e.target.value)}
                placeholder="e.g., What does this concept mean? How do I approach this type of question?"
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty for a general explanation of the question
              </p>
            </div>

            {/* Ask Button */}
            <Button
              onClick={askAI}
              loading={loadingAI}
              disabled={loadingAI}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              {loadingAI ? 'Getting Rin-chan explanation...' : 'Get Rin-chan explanation'}
            </Button>

            {/* AI Response */}
            {aiError && (
              <div className="rounded-md bg-red-50 p-3">
                <div className="text-sm text-red-700">{aiError}</div>
              </div>
            )}

            {aiExplanation && (
              <div className="rounded-md bg-green-50 p-4">
                <h4 className="font-medium text-green-900 mb-3">🎓 AI Explanation:</h4>
                <MarkdownRenderer
                  content={aiExplanation}
                  className="text-green-800"
                />
              </div>
            )}

            {/* Disclaimer */}
            <div className="text-xs text-gray-500 bg-yellow-50 p-3 rounded-md">
              <strong>📝 Note:</strong> This AI explanation is for learning purposes.
              It won't reveal the correct answer directly but will help you understand
              the concepts and approach to solve the question.
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
} 