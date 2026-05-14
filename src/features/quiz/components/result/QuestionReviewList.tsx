'use client';

import Image from 'next/image';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { ChatMessage } from '@/features/quiz/hooks/useStreamingChatSession';

type TranslateParams = Record<string, string | number | Date>;

interface QuestionData {
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  correctIndex?: number;
  correctIndexes?: number[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
  userAnswer: number | number[];
  isCorrect: boolean;
}

interface QuestionReviewListProps {
  questions: QuestionData[];
  bookmarkedQuestions: Set<number>;
  bookmarkLoading: Set<number>;
  onToggleBookmark: (questionIndex: number, questionData: QuestionData) => void;
  onOpenAI: (questionData: QuestionData, questionIndex: number) => void;
  getHistory: (key: string | number) => ChatMessage[];
  formatAnswer: (
    answer: number | number[],
    options: string[],
    type: 'single' | 'multiple',
    isAnswered?: boolean,
  ) => string;
  formatCorrectAnswer: (question: QuestionData) => string;
  t: (key: string, values?: TranslateParams) => string;
  tProfile: (key: string) => string;
}

const OptionImage = ({ src, alt }: { src: string; alt: string }) => (
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
  getHistory,
  formatAnswer,
  formatCorrectAnswer,
  t,
  tProfile,
}: QuestionReviewListProps) {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>{tProfile('details')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {questions.map((questionResult, index) => {
            // Calculate if answered based on user answer
            const isAnswered =
              questionResult.type === 'single'
                ? questionResult.userAnswer !== -1
                : Array.isArray(questionResult.userAnswer) && questionResult.userAnswer.length > 0;

            return (
              <div
                key={index}
                className={`border rounded-lg p-4 ${
                  questionResult.isCorrect
                    ? 'border-green-200 bg-green-50'
                    : isAnswered
                      ? 'border-red-200 bg-red-50'
                      : 'border-neutral-200 bg-neutral-50'
                }`}
              >
                <div className="mb-3">
                  <div className="mb-5 flex space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => onToggleBookmark(index, questionResult)}
                      disabled={bookmarkLoading.has(index)}
                      className={`${
                        bookmarkedQuestions.has(index)
                          ? 'text-yellow-600 border-yellow-200 bg-yellow-50 hover:bg-yellow-100'
                          : 'text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                      }`}
                      title={
                        bookmarkedQuestions.has(index)
                          ? 'Remove bookmark'
                          : 'Bookmark this question'
                      }
                    >
                      {bookmarkLoading.has(index) ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
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
                      {getHistory(index).length > 0 && (
                        <span className="ml-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                          {Math.floor(getHistory(index).length / 2)}
                        </span>
                      )}
                    </Button>
                  </div>

                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-neutral-900 flex-1">
                      {index + 1}. {questionResult.question}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
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
                        className={`px-2 py-1 rounded text-xs font-medium ${
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
                            ? '✗ Incorrect'
                            : `— ${t('notAnswered')}`}
                      </span>
                    </div>
                  </div>
                </div>

                {questionResult.questionImage && (
                  <div className="mb-4">
                    <OptionImage src={questionResult.questionImage} alt="Question image" />
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-medium text-neutral-700">{t('yourAnswer')}: </span>
                    <span
                      className={
                        questionResult.isCorrect
                          ? 'text-green-600'
                          : isAnswered
                            ? 'text-red-600'
                            : 'text-neutral-500'
                      }
                    >
                      {formatAnswer(
                        questionResult.userAnswer,
                        questionResult.options,
                        questionResult.type,
                        isAnswered,
                      )}
                    </span>
                  </div>

                  {!questionResult.isCorrect && (
                    <div className="text-sm">
                      <span className="font-medium text-neutral-700">{tProfile('correct')}: </span>
                      <span className="text-green-600">{formatCorrectAnswer(questionResult)}</span>
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

                        const optionText = String.fromCharCode(65 + optIdx) + '. ' + option;

                        return (
                          <div
                            key={optIdx}
                            className={`text-sm p-2 rounded border flex items-center ${
                              isCorrectAnswer
                                ? 'bg-green-100 border-green-300 text-green-800'
                                : isUserAnswer
                                  ? 'bg-red-100 border-red-300 text-red-800'
                                  : 'bg-neutral-50 border-neutral-200 text-neutral-700'
                            }`}
                          >
                            <div className="flex-1">
                              <span className="text-neutral-900">{optionText}</span>

                              {(() => {
                                const optionImage = questionResult.optionImages?.[optIdx];
                                return optionImage ? (
                                  <div className="mt-2">
                                    <OptionImage
                                      src={optionImage}
                                      alt={`Option ${String.fromCharCode(65 + optIdx)} image`}
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
