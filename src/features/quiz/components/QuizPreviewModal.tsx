'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { QuestionOptionsPreview } from '@/features/quiz/components/shared/QuestionOptionsPreview';
import { formatCorrectAnswerText } from '@/lib/quiz/answer-text';
import type { QuizPreviewQuestionViewModel } from '@/features/quiz/types/quiz-preview-view-model';

interface QuizPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  questions: QuizPreviewQuestionViewModel[];
  previewKey?: string;
}

export function QuizPreviewModal({
  isOpen,
  onClose,
  title,
  questions,
  previewKey,
}: QuizPreviewModalProps) {
  const effectivePreviewKey = previewKey ?? `${title}:${questions.length}`;
  const [questionCursor, setQuestionCursor] = useState({
    previewKey: effectivePreviewKey,
    index: 0,
  });
  const t = useTranslations('quizPreview');
  const tQuiz = useTranslations('quiz');

  if (questions.length === 0) {
    return null;
  }

  const activeQuestionIndex =
    questionCursor.previewKey === effectivePreviewKey ? questionCursor.index : 0;
  const safeQuestionIndex = Math.min(activeQuestionIndex, questions.length - 1);
  const currentQuestion = questions[safeQuestionIndex];

  if (!currentQuestion) {
    return null;
  }

  const setCurrentQuestionIndex = (index: number) => {
    setQuestionCursor({ previewKey: effectivePreviewKey, index });
  };

  const nextQuestion = () => {
    if (safeQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(safeQuestionIndex + 1);
    }
  };

  const previousQuestion = () => {
    if (safeQuestionIndex > 0) {
      setCurrentQuestionIndex(safeQuestionIndex - 1);
    }
  };

  const currentQuestionKey = `${effectivePreviewKey}:${safeQuestionIndex}`;
  const correctIndexes =
    currentQuestion.type === 'single'
      ? [currentQuestion.correctIndex]
      : currentQuestion.correctIndexes;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('title')} size="large">
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-neutral-800 mb-2">{title}</h3>
          <div className="text-sm text-neutral-600">
            {t('questionOf', { current: safeQuestionIndex + 1, total: questions.length })}
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-x-2">
              <span>{currentQuestion.question}</span>
              {currentQuestion.type === 'single' ? (
                <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                  {t('singleChoice')}
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                  {t('multipleChoice')}
                </span>
              )}
            </CardTitle>

            {/* Display question image if exists */}
          </CardHeader>
          <CardContent>
            <QuestionOptionsPreview
              key={currentQuestionKey}
              questionImage={currentQuestion.questionImage}
              options={currentQuestion.options}
              optionImages={currentQuestion.optionImages}
              correctIndexes={correctIndexes}
              correctLabel={t('correct')}
              showOptionImages
              optionsClassName="space-y-3"
              optionItemClassName="rounded-lg border-2 border-neutral-200 bg-neutral-50 p-3 text-neutral-700"
              highlightedOptionItemClassName="rounded-lg border-2 border-green-500 bg-green-50 p-3"
            />

            <div className="mt-4 p-3 bg-green-50 rounded-lg">
              <div className="text-sm font-medium text-green-800 mb-1">{t('correctAnswers')}:</div>
              <div className="text-sm text-green-700">
                {formatCorrectAnswerText(currentQuestion, t('noCorrectAnswer'))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center mb-4">
          <Button variant="outline" onClick={previousQuestion} disabled={safeQuestionIndex === 0}>
            ← {tQuiz('previous')}
          </Button>

          <div className="text-sm text-neutral-600">
            {safeQuestionIndex + 1} / {questions.length}
          </div>

          <Button
            variant="outline"
            onClick={nextQuestion}
            disabled={safeQuestionIndex === questions.length - 1}
          >
            {tQuiz('next')} →
          </Button>
        </div>

        {/* Question Overview */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-neutral-900 mb-3">{t('questionOverview')}</h4>
          <div className="grid grid-cols-10 gap-2">
            {questions.map((question, index) => (
              <button
                type="button"
                key={`${question.question}-${question.options.join('|')}`}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                  index === safeQuestionIndex
                    ? 'bg-brand-action text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
