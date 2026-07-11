'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useHotkeys } from 'react-hotkeys-hook';
import { Card } from './ui/Card';
import type {
  ReviewQuestionReferenceViewModel,
  ReviewRating,
} from '@/features/review/types/review-session';

interface ReviewCardProps {
  question: ReviewQuestionReferenceViewModel;
  onResult: (rating: ReviewRating) => void;
}

import { HiCheck } from 'react-icons/hi';

const CARD_FLIP_CONTAINER_STYLE = { perspective: '1000px' } as const;
const CARD_FLIP_STYLE = { transformStyle: 'preserve-3d' } as const;
const CARD_FACE_STYLE = { backfaceVisibility: 'hidden' } as const;
const CARD_BACK_FACE_STYLE = {
  ...CARD_FACE_STYLE,
  transform: 'rotateY(180deg)',
} as const;

export default function ReviewCard({ question, onResult }: ReviewCardProps) {
  const t = useTranslations('review');
  const [isFlipped, setIsFlipped] = useState(false);

  useHotkeys(
    'space',
    (e) => {
      e.preventDefault();
      setIsFlipped((prev) => !prev);
    },
    { enableOnFormTags: false, preventDefault: true },
  );
  useHotkeys('1', () => isFlipped && onResult('fail'), { enableOnFormTags: false }, [
    isFlipped,
    onResult,
  ]);
  useHotkeys('2', () => isFlipped && onResult('hard'), { enableOnFormTags: false }, [
    isFlipped,
    onResult,
  ]);
  useHotkeys('3', () => isFlipped && onResult('good'), { enableOnFormTags: false }, [
    isFlipped,
    onResult,
  ]);
  useHotkeys('4', () => isFlipped && onResult('easy'), { enableOnFormTags: false }, [
    isFlipped,
    onResult,
  ]);

  return (
    <div className="relative w-full max-w-2xl" style={CARD_FLIP_CONTAINER_STYLE}>
      <div
        className="relative w-full transition-all duration-500"
        style={{
          ...CARD_FLIP_STYLE,
          minHeight: 'min(400px, 70vh)',
          transform: isFlipped ? 'rotateY(180deg)' : undefined,
        }}
      >
        {/* Front Face */}
        {!isFlipped && (
          <Card
            className="absolute inset-0 flex h-full w-full cursor-pointer flex-col items-center justify-center p-6 transition-shadow hover:shadow-lg md:p-8"
            onClick={() => setIsFlipped(true)}
            style={CARD_FACE_STYLE}
          >
            <div className="text-center">
              <span className="inline-block px-3 py-1 bg-green-100 text-brand-trust-hover rounded-full text-xs font-semibold mb-4">
                {t('question')}
              </span>
              <h3 className="text-xl md:text-2xl font-medium text-[var(--text-primary)] mb-8 leading-relaxed">
                {question.text}
              </h3>
              <p className="text-[var(--text-muted)] text-sm animate-pulse">
                {t('tapToSeeAnswer')}
              </p>
            </div>
          </Card>
        )}

        {/* Back Face (Answer) */}
        {isFlipped && (
          <Card
            className="absolute inset-0 flex h-full w-full flex-col p-4 md:p-8"
            style={CARD_BACK_FACE_STYLE}
          >
            <div className="flex-1 overflow-y-auto">
              {/* Question Text Repeated Small */}
              <p className="text-xs md:text-sm text-[var(--text-muted)] mb-4 md:mb-6 pb-3 md:pb-4 border-b">
                {question.text}
              </p>

              {/* Options / Answer */}
              <div className="space-y-2 md:space-y-3">
                {(() => {
                  const correctIndexSet = new Set(question.correctIndexes);
                  return question.options.map((opt, idx) => {
                    const isCorrect = correctIndexSet.has(idx);
                    const optionLabel = String.fromCharCode(65 + idx);
                    return (
                      <div
                        key={`${optionLabel}-${opt}`}
                        className={`p-3 md:p-4 rounded-xl border ${
                          isCorrect
                            ? 'bg-green-50 border-green-200 text-green-800'
                            : 'bg-neutral-50 border-neutral-100 text-neutral-500'
                        }`}
                      >
                        <div className="flex items-start">
                          <div
                            className={`mt-0.5 mr-3 flex size-5 flex-shrink-0 items-center justify-center rounded-full border ${
                              isCorrect
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-neutral-300'
                            }`}
                          >
                            {isCorrect && (
                              <HiCheck className="size-3" strokeWidth={3} aria-hidden="true" />
                            )}
                          </div>
                          <span
                            className={`text-sm md:text-base ${isCorrect ? 'font-medium' : ''}`}
                          >
                            {opt}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Rating Buttons */}
            <div className="mt-4 md:mt-8 grid grid-cols-4 gap-2 md:gap-3 pt-4 border-t">
              <button
                type="button"
                className="flex flex-col items-center p-2 rounded-lg hover:bg-red-50 active:bg-red-100 transition-colors group min-h-[68px]"
                onClick={() => onResult('fail')}
                aria-label={t('rateAs', { label: t('again'), number: 1 })}
              >
                <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-red-100 text-red-600 transition-transform group-hover:scale-110 md:mb-2 md:size-11">
                  <span className="font-bold text-sm md:text-base">1</span>
                </div>
                <span className="text-[10px] md:text-xs font-medium text-red-600">
                  {t('again')}
                </span>
              </button>

              <button
                type="button"
                className="flex flex-col items-center p-2 rounded-lg hover:bg-orange-50 active:bg-orange-100 transition-colors group min-h-[68px]"
                onClick={() => onResult('hard')}
                aria-label={t('rateAs', { label: t('hard'), number: 2 })}
              >
                <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-orange-100 text-orange-600 transition-transform group-hover:scale-110 md:mb-2 md:size-11">
                  <span className="font-bold text-sm md:text-base">2</span>
                </div>
                <span className="text-[10px] md:text-xs font-medium text-orange-600">
                  {t('hard')}
                </span>
              </button>

              <button
                type="button"
                className="flex flex-col items-center p-2 rounded-lg hover:bg-green-50 active:bg-green-100 transition-colors group min-h-[68px]"
                onClick={() => onResult('good')}
                aria-label={t('rateAs', { label: t('good'), number: 3 })}
              >
                <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-green-100 text-green-600 transition-transform group-hover:scale-110 md:mb-2 md:size-11">
                  <span className="font-bold text-sm md:text-base">3</span>
                </div>
                <span className="text-[10px] md:text-xs font-medium text-green-600">
                  {t('good')}
                </span>
              </button>

              <button
                type="button"
                className="flex flex-col items-center p-2 rounded-lg hover:bg-green-50 active:bg-green-100 transition-colors group min-h-[68px]"
                onClick={() => onResult('easy')}
                aria-label={t('rateAs', { label: t('easy'), number: 4 })}
              >
                <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-green-100 text-green-600 transition-transform group-hover:scale-110 md:mb-2 md:size-11">
                  <span className="font-bold text-sm md:text-base">4</span>
                </div>
                <span className="text-[10px] md:text-xs font-medium text-green-600">
                  {t('easy')}
                </span>
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
