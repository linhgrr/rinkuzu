'use client';

import { Button } from '@/components/ui/Button';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { DynamicMarkdownRenderer as MarkdownRenderer } from '@/components/ui/DynamicMarkdownRenderer';
import { OptionImage, QuestionImage } from '@/components/ui/ImageDisplay';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { HiOutlineArrowLeft, HiOutlineMail, HiOutlineUser } from '@/components/icons';
import { QuestionDiscussion } from '@/features/quiz/components/QuestionDiscussion';
import ReportQuiz from '@/features/quiz/components/ReportQuiz';

type QuizAnswer = number | number[];
type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

interface QuizQuestion {
  _id?: string;
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

interface DesktopQuizDiscussionControls {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

interface DesktopQuizExitControls {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  confirmExit: () => void;
}

interface DesktopQuizAIControls {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  userQuestion: string;
  setUserQuestion: (value: string) => void;
  ask: () => Promise<void>;
  loading: boolean;
  error: string;
  explanation: string;
}

interface DesktopQuizSubmitControls {
  confirmOpen: boolean;
  setConfirmOpen: (open: boolean) => void;
  unansweredCount: number;
  complete: () => Promise<boolean>;
}

interface DesktopQuizLayoutProps {
  slug: string;
  quizTitle: string;
  questions: QuizQuestion[];
  sessionEmail?: string | null;
  userEmail: string;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: (index: number) => void;
  answeredQuestions: number;
  progress: number;
  currentQuestion: QuizQuestion;
  userAnswers: QuizAnswer[];
  discussion: DesktopQuizDiscussionControls;
  exit: DesktopQuizExitControls;
  error: string;
  selectAnswer: (index: number) => void;
  previousQuestion: () => void;
  nextQuestion: () => void;
  submitQuiz: () => Promise<boolean>;
  submitting: boolean;
  ai: DesktopQuizAIControls;
  submit: DesktopQuizSubmitControls;
  t: TranslateFn;
}

function isQuestionAnswered(question: QuizQuestion, answer: QuizAnswer | undefined) {
  return question.type === 'single' ? answer !== -1 : Array.isArray(answer) && answer.length > 0;
}

function isSelectedOption(
  question: QuizQuestion,
  answer: QuizAnswer | undefined,
  optionIndex: number,
) {
  return question.type === 'single'
    ? answer === optionIndex
    : Array.isArray(answer) && answer.includes(optionIndex);
}

function OptionPreview({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  if (!src) {
    return null;
  }

  return <OptionImage src={src} alt={alt} className={className} />;
}

function DesktopQuizHeader({
  slug,
  quizTitle,
  sessionEmail,
  userEmail,
  currentQuestionIndex,
  questionCount,
  answeredQuestions,
  progress,
  onExit,
  t,
}: {
  slug: string;
  quizTitle: string;
  sessionEmail?: string | null;
  userEmail: string;
  currentQuestionIndex: number;
  questionCount: number;
  answeredQuestions: number;
  progress: number;
  onExit: () => void;
  t: TranslateFn;
}) {
  return (
    <div className="border-b border-neutral-200/50 bg-white/80 sticky top-0 z-40 backdrop-blur-sm">
      <div className="mx-auto max-w-4xl p-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-x-4">
            <Button
              variant="outline"
              onClick={onExit}
              className="border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50"
            >
              <HiOutlineArrowLeft className="mr-2 size-4" />
              {t('exitQuiz')}
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-neutral-900">{quizTitle}</h1>
              <p className="text-sm">
                {sessionEmail ? (
                  <Badge variant="success" className="text-xs">
                    <HiOutlineUser className="mr-1 size-3" />
                    {sessionEmail}
                  </Badge>
                ) : (
                  <Badge variant="default" className="text-xs">
                    <HiOutlineMail className="mr-1 size-3" />
                    {userEmail}
                  </Badge>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-x-4">
            <ReportQuiz quizSlug={slug} quizTitle={quizTitle} />
            <div className="text-right">
              <div className="text-sm font-semibold text-neutral-700">
                {t('question')} {currentQuestionIndex + 1} {t('of', { ns: 'common' })}{' '}
                {questionCount}
              </div>
              <div className="text-xs text-neutral-500">
                {answeredQuestions} {t('of', { ns: 'common' })} {questionCount} {t('answered')}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-neutral-600">
            <span>{t('progress')}</span>
            <span>
              {progress}% {t('complete')}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-brand-trust to-green-600 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopQuestionCard({
  currentQuestion,
  currentQuestionIndex,
  currentAnswer,
  questionCount,
  onOpenAI,
  onToggleDiscussion,
  onSelectAnswer,
  onPrevious,
  onNext,
  onSubmit,
  submitting,
  error,
  t,
}: {
  currentQuestion: QuizQuestion;
  currentQuestionIndex: number;
  currentAnswer: QuizAnswer | undefined;
  questionCount: number;
  onOpenAI: () => void;
  onToggleDiscussion: () => void;
  onSelectAnswer: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => Promise<boolean>;
  submitting: boolean;
  error: string;
  t: TranslateFn;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-xl font-semibold [&_p]:m-0 [&_p]:text-xl [&_p]:text-neutral-900">
              <MarkdownRenderer content={currentQuestion.question} />
            </div>
          </div>
          <div className="ml-4 flex items-center gap-x-2">
            <Button
              variant="outline"
              onClick={onOpenAI}
              className="border-green-200 text-brand-trust hover:border-green-300 hover:bg-green-50"
            >
              {t('askRinChan')}
            </Button>
            <Button
              variant="outline"
              onClick={onToggleDiscussion}
              className="border-green-200 text-brand-trust hover:border-green-300 hover:bg-green-50"
              title={t('discussion')}
            >
              {t('discussion')}
            </Button>
          </div>
        </div>

        {currentQuestion.questionImage ? (
          <div className="mt-4">
            <QuestionImage
              src={currentQuestion.questionImage}
              alt={`Question ${currentQuestionIndex + 1} image`}
            />
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {currentQuestion.options.map((option, index) => {
            const isSelected = isSelectedOption(currentQuestion, currentAnswer, index);

            return (
              <label
                key={option}
                className={`flex cursor-pointer items-center rounded-lg border-2 p-4 transition-colors ${
                  isSelected
                    ? 'border-green-500 bg-green-50'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <input
                  type={currentQuestion.type === 'single' ? 'radio' : 'checkbox'}
                  name={`question-${currentQuestionIndex}`}
                  value={index}
                  checked={isSelected}
                  onChange={() => onSelectAnswer(index)}
                  className="sr-only"
                />
                <div
                  className={`mr-3 flex size-4 items-center justify-center border-2 ${
                    currentQuestion.type === 'single' ? 'rounded-full' : 'rounded'
                  } ${isSelected ? 'border-green-500 bg-green-500' : 'border-neutral-300'}`}
                >
                  {isSelected ? (
                    currentQuestion.type === 'single' ? (
                      <div className="size-2 rounded-full bg-white" />
                    ) : (
                      <svg className="size-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )
                  ) : null}
                </div>
                <div className="flex-1">
                  <div className="text-neutral-900 [&_p]:m-0 [&_p]:text-base [&_p]:text-neutral-900">
                    <MarkdownRenderer content={option} />
                  </div>
                  <div className="mt-2">
                    <OptionPreview
                      src={currentQuestion.optionImages?.[index]}
                      alt={`Option ${String.fromCharCode(65 + index)} image`}
                    />
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {error ? (
          <div className="mt-4 rounded-md bg-red-50 p-3">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-between">
          <Button variant="outline" onClick={onPrevious} disabled={currentQuestionIndex === 0}>
            {t('previous')}
          </Button>

          <div className="text-sm text-neutral-600">
            {currentQuestionIndex + 1} / {questionCount}
          </div>

          {currentQuestionIndex === questionCount - 1 ? (
            <Button
              onClick={onSubmit}
              loading={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {t('submitQuiz')}
            </Button>
          ) : (
            <Button onClick={onNext} disabled={currentQuestionIndex === questionCount - 1}>
              {t('next')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DesktopQuestionOverview({
  questions,
  userAnswers,
  currentQuestionIndex,
  onJumpToQuestion,
  t,
}: {
  questions: QuizQuestion[];
  userAnswers: QuizAnswer[];
  currentQuestionIndex: number;
  onJumpToQuestion: (index: number) => void;
  t: TranslateFn;
}) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">{t('questionOverview')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-10 gap-2">
          {questions.map((question, index) => {
            const isAnswered = isQuestionAnswered(question, userAnswers[index]);

            return (
              <button
                key={question.question}
                onClick={() => onJumpToQuestion(index)}
                className={`size-8 rounded text-xs font-medium transition-colors ${
                  index === currentQuestionIndex
                    ? 'bg-brand-trust text-white'
                    : isAnswered
                      ? 'border border-green-300 bg-green-100 text-green-800'
                      : 'border border-neutral-300 bg-neutral-100 text-neutral-600'
                }`}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-x-6 text-xs">
          <div className="flex items-center">
            <div className="mr-2 size-3 rounded bg-brand-trust" />
            <span>{t('current')}</span>
          </div>
          <div className="flex items-center">
            <div className="mr-2 size-3 rounded border border-green-300 bg-green-100" />
            <span>{t('answered')}</span>
          </div>
          <div className="flex items-center">
            <div className="mr-2 size-3 rounded border border-neutral-300 bg-neutral-100" />
            <span>{t('notAnswered')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DesktopDiscussionModal({
  isOpen,
  onClose,
  slug,
  questionIndex,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  questionIndex: number;
  t: TranslateFn;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('discussion')}
      size="large"
      className="md:hidden"
    >
      <div className="h-96">
        <QuestionDiscussion
          quizSlug={slug}
          questionIndex={questionIndex}
          isCollapsed={false}
          onToggleCollapse={onClose}
          isMobile={true}
        />
      </div>
    </Modal>
  );
}

function DesktopExitModal({
  isOpen,
  onClose,
  onConfirmExit,
  answeredQuestions,
  questionCount,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExit: () => void;
  answeredQuestions: number;
  questionCount: number;
  t: TranslateFn;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('exitQuiz')} size="small">
      <div className="space-y-4">
        <p className="text-neutral-700">{t('exitQuizWarning')}</p>

        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
          <div className="flex items-start">
            <svg
              className="mr-2 mt-0.5 size-5 flex-shrink-0 text-yellow-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-yellow-800">{t('exitWarning')}</h4>
              <p className="mt-1 text-sm text-yellow-700">
                {t('exitWarningMessage', {
                  answered: answeredQuestions,
                  total: questionCount,
                })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            {t('continueQuiz')}
          </Button>
          <Button onClick={onConfirmExit} className="flex-1 bg-red-600 text-white hover:bg-red-700">
            {t('exitQuiz')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DesktopAIModal({
  isOpen,
  onClose,
  currentQuestion,
  userQuestion,
  onUserQuestionChange,
  onAskAI,
  loading,
  error,
  explanation,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentQuestion: QuizQuestion;
  userQuestion: string;
  onUserQuestionChange: (value: string) => void;
  onAskAI: () => Promise<void>;
  loading: boolean;
  error: string;
  explanation: string;
  t: TranslateFn;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('askRinChan')} size="wide">
      <div className="space-y-4">
        <div className="rounded-lg bg-neutral-50 p-4">
          <h4 className="mb-2 font-medium text-neutral-900">{t('currentQuestion')}</h4>
          <div className="text-sm text-neutral-700 [&_p]:mb-0 [&_p]:text-sm [&_p]:text-neutral-700">
            <MarkdownRenderer content={currentQuestion.question} />
          </div>
          <div className="mt-2 space-y-1">
            {currentQuestion.options.map((option, index) => (
              <div key={option} className="flex items-start gap-x-2 text-xs text-neutral-600">
                <span className="mt-0.5">{String.fromCharCode(65 + index)}.</span>
                <div className="flex-1 [&_p]:m-0 [&_p]:text-xs [&_p]:text-neutral-600">
                  <MarkdownRenderer content={option} />
                </div>
                <OptionPreview
                  src={currentQuestion.optionImages?.[index]}
                  alt={`Option ${index} image`}
                  className="ml-1"
                />
              </div>
            ))}
          </div>
          {currentQuestion.questionImage ? (
            <div className="mt-3">
              <QuestionImage src={currentQuestion.questionImage} alt="Question img" />
            </div>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-700">
            {t('askSpecificQuestion')}
          </label>
          <Input
            value={userQuestion}
            onChange={(event) => onUserQuestionChange(event.target.value)}
            placeholder={t('questionPlaceholder')}
            className="w-full"
          />
          <p className="mt-1 text-xs text-neutral-500">{t('leaveEmptyGeneral')}</p>
        </div>

        <Button
          onClick={onAskAI}
          loading={loading}
          disabled={loading}
          className="w-full bg-brand-trust text-white hover:bg-brand-trust-hover"
        >
          {loading ? t('gettingExplanation') : t('getRinChanExplanation')}
        </Button>

        {error ? (
          <div className="rounded-md bg-red-50 p-3">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        ) : null}

        {explanation ? (
          <div className="rounded-md bg-green-50 p-4">
            <h4 className="mb-3 font-medium text-green-900">{t('aiExplanation')}</h4>
            <MarkdownRenderer content={explanation} className="text-green-800" />
          </div>
        ) : null}

        <div className="rounded-md bg-yellow-50 p-3 text-xs text-yellow-800">{t('aiNote')}</div>
      </div>
    </Modal>
  );
}

export function DesktopQuizLayout({
  slug,
  quizTitle,
  questions,
  sessionEmail,
  userEmail,
  currentQuestionIndex,
  setCurrentQuestionIndex,
  answeredQuestions,
  progress,
  currentQuestion,
  userAnswers,
  discussion,
  exit,
  error,
  selectAnswer,
  previousQuestion,
  nextQuestion,
  submitQuiz,
  submitting,
  ai,
  submit,
  t,
}: DesktopQuizLayoutProps) {
  return (
    <div className="min-h-screen">
      <DesktopQuizHeader
        slug={slug}
        quizTitle={quizTitle}
        sessionEmail={sessionEmail}
        userEmail={userEmail}
        currentQuestionIndex={currentQuestionIndex}
        questionCount={questions.length}
        answeredQuestions={answeredQuestions}
        progress={progress}
        onExit={exit.open}
        t={t}
      />

      <main
        className={`${discussion.collapsed ? 'max-w-4xl' : 'max-w-7xl'} mx-auto px-4 py-8 transition-all duration-300 sm:px-6 lg:px-8`}
      >
        <div className="flex">
          <div className={`flex-1 ${discussion.collapsed ? '' : 'pr-6'}`}>
            <DesktopQuestionCard
              currentQuestion={currentQuestion}
              currentQuestionIndex={currentQuestionIndex}
              currentAnswer={userAnswers[currentQuestionIndex]}
              questionCount={questions.length}
              onOpenAI={ai.open}
              onToggleDiscussion={() => discussion.setCollapsed(!discussion.collapsed)}
              onSelectAnswer={selectAnswer}
              onPrevious={previousQuestion}
              onNext={nextQuestion}
              onSubmit={submitQuiz}
              submitting={submitting}
              error={error}
              t={t}
            />

            <DesktopQuestionOverview
              questions={questions}
              userAnswers={userAnswers}
              currentQuestionIndex={currentQuestionIndex}
              onJumpToQuestion={setCurrentQuestionIndex}
              t={t}
            />
          </div>

          <QuestionDiscussion
            quizSlug={slug}
            questionIndex={currentQuestionIndex}
            isCollapsed={discussion.collapsed}
            onToggleCollapse={() => discussion.setCollapsed(!discussion.collapsed)}
          />
        </div>

        <DesktopDiscussionModal
          isOpen={discussion.mobileOpen}
          onClose={() => discussion.setMobileOpen(false)}
          slug={slug}
          questionIndex={currentQuestionIndex}
          t={t}
        />

        <DesktopExitModal
          isOpen={exit.isOpen}
          onClose={exit.close}
          onConfirmExit={exit.confirmExit}
          answeredQuestions={answeredQuestions}
          questionCount={questions.length}
          t={t}
        />

        <DesktopAIModal
          isOpen={ai.isOpen}
          onClose={ai.close}
          currentQuestion={currentQuestion}
          userQuestion={ai.userQuestion}
          onUserQuestionChange={ai.setUserQuestion}
          onAskAI={ai.ask}
          loading={ai.loading}
          error={ai.error}
          explanation={ai.explanation}
          t={t}
        />

        <ConfirmModal
          isOpen={submit.confirmOpen}
          title={`${t('submitQuiz')}?`}
          message={t('unansweredWarning', { count: submit.unansweredCount })}
          confirmText={t('submit')}
          cancelText={t('cancel')}
          confirmVariant="primary"
          isLoading={submitting}
          onCancel={() => submit.setConfirmOpen(false)}
          onConfirm={() => void submit.complete()}
        />
      </main>
    </div>
  );
}
