'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { QuestionImage, OptionImage } from '@/components/ui/ImageDisplay';
import { IQuestion } from '@/models/Quiz';

interface QuizPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  questions: IQuestion[];
}

export function QuizPreviewModal({ isOpen, onClose, title, questions }: QuizPreviewModalProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const t = useTranslations('quizPreview');
  const tQuiz = useTranslations('quiz');

  if (!questions || questions.length === 0) {
    return null;
  }

  const currentQuestion = questions[currentQuestionIndex];

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((index) => index + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((index) => index - 1);
    }
  };

  const getCorrectAnswerText = (question: IQuestion) => {
    if (question.type === 'single' && question.correctIndex !== undefined) {
      return question.options[question.correctIndex];
    } else if (question.type === 'multiple' && question.correctIndexes) {
      return question.correctIndexes.map((idx) => question.options[idx]).join(', ');
    }
    return t('noCorrectAnswer');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="large">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-neutral-900">{t('title')}</h2>
          <Button variant="ghost" onClick={onClose}>
            ✕
          </Button>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-neutral-800 mb-2">{title}</h3>
          <div className="text-sm text-neutral-600">
            {t('questionOf', { current: currentQuestionIndex + 1, total: questions.length })}
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
                let isCorrect = false;
                if (currentQuestion.type === 'single') {
                  isCorrect = index === currentQuestion.correctIndex;
                } else if (currentQuestion.type === 'multiple') {
                  isCorrect = currentQuestion.correctIndexes?.includes(index) || false;
                }

                return (
                  <div
                    key={option}
                    className={`p-3 rounded-lg border-2 ${
                      isCorrect
                        ? 'border-green-500 bg-green-50'
                        : 'border-neutral-200 bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center gap-x-3">
                      <div
                        className={`w-4 h-4 rounded ${
                          currentQuestion.type === 'single' ? 'rounded-full' : 'rounded'
                        } border-2 flex items-center justify-center ${
                          isCorrect ? 'border-green-500 bg-green-500' : 'border-neutral-300'
                        }`}
                      >
                        {isCorrect &&
                          (currentQuestion.type === 'single' ? (
                            <div className="size-2 rounded-full bg-white"></div>
                          ) : (
                            <svg
                              className="size-3 text-white"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ))}
                      </div>
                      <div className="flex-1">
                        <span
                          className={`${isCorrect ? 'font-medium text-green-800' : 'text-neutral-700'}`}
                        >
                          {option}
                        </span>
                        {/* Display option image if exists */}
                        {(() => {
                          const optionImage = currentQuestion.optionImages?.[index];
                          return optionImage ? (
                            <div className="mt-2">
                              <OptionImage
                                src={optionImage}
                                alt={`Option ${String.fromCharCode(65 + index)} image`}
                              />
                            </div>
                          ) : null;
                        })()}
                      </div>
                      {isCorrect && (
                        <span className="ml-auto text-green-600 text-sm font-medium">
                          ✓ {t('correct')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 p-3 bg-green-50 rounded-lg">
              <div className="text-sm font-medium text-green-800 mb-1">{t('correctAnswers')}:</div>
              <div className="text-sm text-green-700">{getCorrectAnswerText(currentQuestion)}</div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center mb-4">
          <Button
            variant="outline"
            onClick={previousQuestion}
            disabled={currentQuestionIndex === 0}
          >
            ← {tQuiz('previous')}
          </Button>

          <div className="text-sm text-neutral-600">
            {currentQuestionIndex + 1} / {questions.length}
          </div>

          <Button
            variant="outline"
            onClick={nextQuestion}
            disabled={currentQuestionIndex === questions.length - 1}
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
                  index === currentQuestionIndex
                    ? 'bg-brand-action text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={onClose}>{t('closePreview')}</Button>
        </div>
      </div>
    </Modal>
  );
}
