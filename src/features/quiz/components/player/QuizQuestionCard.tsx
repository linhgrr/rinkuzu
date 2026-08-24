'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { OptionImage, QuestionImage } from '@/components/ui/ImageDisplay';
import { QuestionContent } from '@/components/ui/QuestionContent';
import type { QuizAnswer } from '@/features/quiz/types/quiz-interaction-view-model';
import type { QuizPlayQuestionViewModel } from '@/features/quiz/types/quiz-play-view-model';

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

interface QuizQuestionCardProps {
  question: QuizPlayQuestionViewModel;
  questionIndex: number;
  questionCount: number;
  answer?: QuizAnswer | null;
  headerActions?: ReactNode;
  onSelectAnswer: (optionIndex: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void | Promise<boolean>;
  submitting?: boolean;
  error?: string;
  t: TranslateFn;
}

function isSelectedOption(
  question: QuizPlayQuestionViewModel,
  answer: QuizAnswer | null | undefined,
  optionIndex: number,
) {
  return question.type === 'single'
    ? answer === optionIndex
    : Array.isArray(answer) && answer.includes(optionIndex);
}

export function QuizQuestionCard({
  question,
  questionIndex,
  questionCount,
  answer,
  headerActions,
  onSelectAnswer,
  onPrevious,
  onNext,
  onSubmit,
  submitting = false,
  error,
  t,
}: QuizQuestionCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-xl font-semibold [&_p]:m-0 [&_p]:text-xl [&_p]:text-neutral-900">
              <QuestionContent content={question.question} />
            </div>
          </div>
          {headerActions ? (
            <div className="flex shrink-0 items-center gap-x-2">{headerActions}</div>
          ) : null}
        </div>

        {question.questionImage ? (
          <div className="mt-4">
            <QuestionImage
              src={question.questionImage}
              alt={t('questionImageAlt', { number: questionIndex + 1 })}
            />
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {question.options.map((option, optionIndex) => {
            const selected = isSelectedOption(question, answer, optionIndex);

            return (
              <label
                key={`${optionIndex}:${option}`}
                className={`flex cursor-pointer items-center rounded-lg border-2 p-4 transition-colors ${
                  selected
                    ? 'border-brand-action bg-orange-50'
                    : 'border-line hover:border-line-blue'
                }`}
              >
                <input
                  type={question.type === 'single' ? 'radio' : 'checkbox'}
                  aria-label={`Option ${String.fromCharCode(65 + optionIndex)}`}
                  name={`question-${questionIndex}`}
                  value={optionIndex}
                  checked={selected}
                  onChange={() => onSelectAnswer(optionIndex)}
                  className="sr-only"
                />
                <div
                  className={`mr-3 flex size-4 items-center justify-center border-2 ${
                    question.type === 'single' ? 'rounded-full' : 'rounded'
                  } ${selected ? 'border-brand-action bg-brand-action' : 'border-control-border'}`}
                >
                  {selected ? (
                    question.type === 'single' ? (
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
                <div className="min-w-0 flex-1">
                  <div className="text-neutral-900 [&_p]:m-0 [&_p]:text-base [&_p]:text-neutral-900">
                    <QuestionContent content={option} variant="option" />
                  </div>
                  {question.optionImages?.[optionIndex] ? (
                    <div className="mt-2">
                      <OptionImage
                        src={question.optionImages[optionIndex]}
                        alt={t('optionImageAlt', {
                          option: String.fromCharCode(65 + optionIndex),
                        })}
                      />
                    </div>
                  ) : null}
                </div>
              </label>
            );
          })}
        </div>

        {error ? (
          <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button variant="outline" onClick={onPrevious} disabled={questionIndex === 0}>
            {t('previous')}
          </Button>
          <div className="text-sm text-neutral-600">
            {questionIndex + 1} / {questionCount}
          </div>
          {questionIndex === questionCount - 1 ? (
            <Button onClick={onSubmit} loading={submitting}>
              {t('submitQuiz')}
            </Button>
          ) : (
            <Button onClick={onNext}>{t('next')}</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
