'use client';

import Image from 'next/image';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { QuestionContent } from '@/components/ui/QuestionContent';
import { isQuestionAnswered } from '@/features/quiz/lib/isQuestionAnswered';
import type { QuestionType } from '@/shared/constants/question-type';
import type { QuizQuestionReview } from '@/shared/types/quiz-question';

type TranslateParams = Record<string, string | number | Date>;

type QuestionData = QuizQuestionReview;

interface QuestionReviewListProps {
  questions: QuestionData[];
  bookmarkedQuestions: Set<number>;
  bookmarkLoading: Set<number>;
  onToggleBookmark: (questionIndex: number, questionData: QuestionData) => void;
  onOpenAI: (questionData: QuestionData, questionIndex: number) => void;
  chatTurnsByQuestion: Readonly<Record<number, number>>;
  formatAnswer: (
    answer: number | number[],
    options: string[],
    type: QuestionType,
    isAnswered?: boolean,
  ) => string;
  formatCorrectAnswer: (question: QuestionData) => string;
  t: (key: string, values?: TranslateParams) => string;
  tProfile: (key: string) => string;
}

interface OptionImageProps {
  src: string;
  alt: string;
}

const OptionImage = ({ src, alt }: OptionImageProps) => (
  <Image
    src={src}
    alt={alt}
    width={320}
    height={200}
    className="max-w-full h-auto rounded border"
    style={{ maxHeight: '200px' }}
  />
);

export function QuestionReviewList({
  questions,
  bookmarkedQuestions,
  bookmarkLoading,
  onToggleBookmark,
  onOpenAI,
  chatTurnsByQuestion,
  formatAnswer,
  formatCorrectAnswer,
  t,
  tProfile,
}: QuestionReviewListProps) {
  return (
    <Card className="mb-8 max-md:p-0">
      <CardHeader className="max-md:px-4 max-md:pt-4">
        <CardTitle>{tProfile('details')}</CardTitle>
      </CardHeader>
      <CardContent className="max-md:p-4">
        <div className="space-y-4 md:space-y-6">
          {questions.map((questionResult, index) => {
            const isAnswered = isQuestionAnswered(questionResult, questionResult.userAnswer);
            const chatTurns = chatTurnsByQuestion[index] ?? 0;

            return (
              <div
                key={questionResult.id}
                className={`border rounded-lg p-3 md:p-4 ${
                  questionResult.isCorrect
                    ? 'border-green-200 bg-green-50'
                    : isAnswered
                      ? 'border-red-200 bg-red-50'
                      : 'border-line bg-neutral-50'
                }`}
              >
                <div className="mb-3 flex flex-wrap items-start gap-2 md:gap-y-0">
                  <div
                    data-review-part="actions"
                    className="order-2 flex w-full flex-wrap gap-2 md:order-1 md:mb-5"
                  >
                    <Button
                      variant="outline"
                      onClick={() => onToggleBookmark(index, questionResult)}
                      disabled={bookmarkLoading.has(index)}
                      className={`${
                        bookmarkedQuestions.has(index)
                          ? 'text-yellow-600 border-yellow-200 bg-yellow-50 hover:bg-yellow-100'
                          : 'text-neutral-600 border-control-border hover:bg-neutral-50'
                      }`}
                      title={bookmarkedQuestions.has(index) ? t('removeBookmark') : t('bookmark')}
                    >
                      {bookmarkLoading.has(index) ? (
                        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : bookmarkedQuestions.has(index) ? (
                        t('bookmarked')
                      ) : (
                        t('bookmark')
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => onOpenAI(questionResult, index)}
                      className="text-brand-trust border-green-200 hover:bg-green-50 hover:border-green-300"
                    >
                      {t('askRinChan')}
                      {chatTurns > 0 && (
                        <span className="ml-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                          {chatTurns}
                        </span>
                      )}
                    </Button>
                  </div>

                  <div
                    data-review-part="prompt"
                    className="order-3 flex w-full min-w-0 items-start gap-1 font-semibold text-neutral-900 md:order-2 md:w-auto md:flex-1"
                  >
                    <span className="flex-shrink-0">{index + 1}.</span>
                    <QuestionContent
                      content={questionResult.question}
                      variant="compact"
                      headingLevel={3}
                      className="min-w-0 flex-1 break-words"
                    />
                  </div>
                  <div
                    data-review-part="badges"
                    className="order-1 flex w-full flex-wrap items-center gap-2 md:order-3 md:w-auto md:shrink-0"
                  >
                    <span
                      className={`whitespace-nowrap px-2 py-1 rounded text-xs font-medium ${
                        questionResult.type === 'single'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {questionResult.type === 'single'
                        ? tProfile('singleChoice')
                        : tProfile('multipleChoice')}
                    </span>
                    <span
                      className={`whitespace-nowrap px-2 py-1 rounded text-xs font-medium ${
                        questionResult.isCorrect
                          ? 'bg-green-100 text-green-800'
                          : isAnswered
                            ? 'bg-red-100 text-red-800'
                            : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      {questionResult.isCorrect
                        ? `✓ ${tProfile('correct')}`
                        : isAnswered
                          ? `✗ ${t('incorrect')}`
                          : `— ${t('notAnswered')}`}
                    </span>
                  </div>
                </div>

                {questionResult.questionImage && (
                  <div className="mb-4">
                    <OptionImage
                      src={questionResult.questionImage}
                      alt={t('questionImageAlt', { number: index + 1 })}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-start gap-1 text-sm">
                    <span className="flex-shrink-0 font-medium text-neutral-700">
                      {t('yourAnswer')}:
                    </span>
                    <QuestionContent
                      variant="answer"
                      content={formatAnswer(
                        questionResult.userAnswer,
                        questionResult.options,
                        questionResult.type,
                        isAnswered,
                      )}
                      className={
                        'min-w-0 flex-1 break-words ' +
                        (questionResult.isCorrect
                          ? 'text-green-600'
                          : isAnswered
                            ? 'text-red-600'
                            : 'text-neutral-500')
                      }
                    />
                  </div>

                  {!questionResult.isCorrect && (
                    <div className="flex items-start gap-1 text-sm">
                      <span className="flex-shrink-0 font-medium text-neutral-700">
                        {tProfile('correct')}:
                      </span>
                      <QuestionContent
                        content={formatCorrectAnswer(questionResult)}
                        variant="answer"
                        className="min-w-0 flex-1 break-words text-green-600"
                      />
                    </div>
                  )}

                  <div className="mt-3">
                    <p className="text-sm text-neutral-600 font-medium mb-2">{t('allOptions')}:</p>
                    <div className="grid grid-cols-1 gap-1">
                      {questionResult.options.map((option, optIdx) => {
                        let isUserAnswer = false;

                        // Only check for user answer if question was answered
                        if (isAnswered) {
                          isUserAnswer =
                            questionResult.type === 'single'
                              ? questionResult.userAnswer === optIdx
                              : (questionResult.userAnswer as number[]).includes(optIdx);
                        }

                        const isCorrectAnswer =
                          questionResult.type === 'single'
                            ? questionResult.correctIndex === optIdx
                            : questionResult.correctIndexes?.includes(optIdx);

                        return (
                          <div
                            key={`${optIdx}-${option}`}
                            className={`flex items-start rounded border p-2 text-sm ${
                              isCorrectAnswer
                                ? 'bg-green-100 border-green-300 text-green-800'
                                : isUserAnswer
                                  ? 'bg-red-100 border-red-300 text-red-800'
                                  : 'bg-neutral-50 border-line text-neutral-700'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-1 text-neutral-900">
                                <span className="flex-shrink-0">
                                  {String.fromCharCode(65 + optIdx)}.
                                </span>
                                <QuestionContent
                                  content={option}
                                  variant="option"
                                  className="min-w-0 flex-1 break-words"
                                />
                              </div>

                              {(() => {
                                const optionImage = questionResult.optionImages?.[optIdx];
                                return optionImage ? (
                                  <div className="mt-2">
                                    <OptionImage
                                      src={optionImage}
                                      alt={t('optionImageAlt', {
                                        option: String.fromCharCode(65 + optIdx),
                                      })}
                                    />
                                  </div>
                                ) : null;
                              })()}
                            </div>

                            {isCorrectAnswer && <span className="ml-2 text-green-600">✓</span>}
                            {isUserAnswer && !isCorrectAnswer && isAnswered && (
                              <span className="ml-2 text-red-600">✗</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
