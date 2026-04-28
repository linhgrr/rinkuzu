// /src/components/quiz/MobileQuizPlayer.tsx
'use client';

import Image from 'next/image';
import { useState, useCallback, useRef, type TouchEvent } from 'react';
import { useTranslations } from 'next-intl';
import { HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineCheck } from '@/components/icons';

interface Question {
  _id: string;
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  questionImage?: string;
}

interface MobileQuizPlayerProps {
  questions: Question[];
  onComplete: (answers: Record<string, number | number[]>) => void;
  onExit?: () => void;
}

export function MobileQuizPlayer({
  questions,
  onComplete,
  onExit: _onExit,
}: MobileQuizPlayerProps) {
  const t = useTranslations('quiz');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | number[]>>({});
  const touchStartXRef = useRef<number | null>(null);
  const touchCurrentXRef = useRef<number | null>(null);

  const currentQuestion = questions[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === questions.length - 1;

  const goNext = useCallback(() => {
    if (!isLast) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [isLast]);

  const goPrev = useCallback(() => {
    if (!isFirst) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [isFirst]);

  const handleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const touchX = event.touches[0]?.clientX;
    touchStartXRef.current = touchX ?? null;
    touchCurrentXRef.current = touchX ?? null;
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    touchCurrentXRef.current = event.touches[0]?.clientX ?? null;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchStartXRef.current === null || touchCurrentXRef.current === null) {
      return;
    }

    const deltaX = touchCurrentXRef.current - touchStartXRef.current;
    const threshold = 50;

    if (deltaX > threshold && !isFirst) {
      goPrev();
    } else if (deltaX < -threshold && !isLast) {
      goNext();
    }

    touchStartXRef.current = null;
    touchCurrentXRef.current = null;
  }, [goNext, goPrev, isFirst, isLast]);

  const handleOptionSelect = useCallback(
    (optionIndex: number) => {
      const qId = currentQuestion._id;

      if (currentQuestion.type === 'single') {
        setAnswers((prev) => ({ ...prev, [qId]: optionIndex }));
      } else {
        setAnswers((prev) => {
          const current = (prev[qId] as number[]) || [];
          const newAnswers = current.includes(optionIndex)
            ? current.filter((i) => i !== optionIndex)
            : [...current, optionIndex];
          return { ...prev, [qId]: newAnswers };
        });
      }
    },
    [currentQuestion],
  );

  const isOptionSelected = useCallback(
    (optionIndex: number) => {
      const answer = answers[currentQuestion._id];
      if (Array.isArray(answer)) {
        return answer.includes(optionIndex);
      }
      return answer === optionIndex;
    },
    [answers, currentQuestion._id],
  );

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="fixed inset-0 bg-neutral-50 flex flex-col z-50">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 bg-white border-b border-neutral-100 safe-area-top">
        <div className="flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={isFirst}
            className="p-2 -ml-2 rounded-full active:bg-neutral-100 transition-colors"
            aria-label="Previous question"
          >
            <HiOutlineChevronLeft
              className={`w-6 h-6 ${isFirst ? 'text-neutral-300' : 'text-neutral-600'}`}
              aria-hidden="true"
            />
          </button>

          <div className="text-center">
            <span className="text-sm font-semibold text-neutral-900">
              {t('question')} {currentIndex + 1} / {questions.length}
            </span>
            {/* Progress dots */}
            <div className="flex gap-1 justify-center mt-2 max-w-[200px] mx-auto flex-wrap">
              {questions.map((q, i) => (
                <div
                  key={q._id}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentIndex
                      ? 'bg-brand-action'
                      : answers[q._id] !== undefined
                        ? 'bg-brand-trust'
                        : 'bg-neutral-200'
                  }`}
                />
              ))}
            </div>
          </div>

          <button
            onClick={goNext}
            disabled={isLast}
            className="p-2 -mr-2 rounded-full active:bg-neutral-100 transition-colors"
            aria-label="Next question"
          >
            <HiOutlineChevronRight
              className={`w-6 h-6 ${isLast ? 'text-neutral-300' : 'text-neutral-600'}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* Question Card - Swipeable */}
      <div className="flex-1 overflow-hidden px-4 py-4">
        <div
          className="h-full touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            key={currentQuestion._id}
            className="h-full bg-white rounded-2xl shadow-sm border border-neutral-100 p-5 flex flex-col overflow-hidden"
          >
            {/* Question Image */}
            {currentQuestion.questionImage && (
              <div className="mb-4 rounded-xl overflow-hidden bg-neutral-100 flex-shrink-0">
                <Image
                  src={currentQuestion.questionImage}
                  alt={`Image for question ${currentIndex + 1}`}
                  width={400}
                  height={144}
                  className="w-full h-auto max-h-36 object-contain"
                />
              </div>
            )}

            {/* Question Text */}
            <div className="mb-4 flex-shrink-0">
              <span className="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-neutral-100 text-neutral-600 mb-2">
                {currentQuestion.type === 'single'
                  ? t('singleChoiceHelper')
                  : t('multipleChoiceHelper')}
              </span>
              <p className="text-base font-medium text-neutral-900 leading-relaxed">
                {currentQuestion.question}
              </p>
            </div>

            {/* Options */}
            <div className="flex-1 space-y-2.5 overflow-y-auto pb-2">
              {currentQuestion.options.map((option, optIdx) => (
                <button
                  key={optIdx}
                  onClick={() => handleOptionSelect(optIdx)}
                  className={`
                      w-full p-4 rounded-xl border-2 text-left transition-all duration-150
                      ${
                        isOptionSelected(optIdx)
                          ? 'border-brand-action bg-orange-50'
                          : 'border-neutral-100 bg-neutral-50 active:border-neutral-200 active:bg-neutral-100'
                      }
                    `}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`
                          w-6 h-6 rounded-full border-2 flex items-center justify-center
                          flex-shrink-0 transition-all duration-150
                          ${
                            isOptionSelected(optIdx)
                              ? 'border-brand-action bg-brand-action'
                              : 'border-neutral-300 bg-white'
                          }
                        `}
                    >
                      {isOptionSelected(optIdx) && (
                        <HiOutlineCheck className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <span className="flex-1 text-sm text-neutral-800">{option}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-4 py-4 bg-white border-t border-neutral-100 safe-area-bottom">
        {/* Swipe hint */}
        <p className="text-center text-xs text-neutral-400 mb-3">
          ← {t('previous')} / {t('next')} →
        </p>

        {/* Complete button */}
        <button
          onClick={() => onComplete(answers)}
          className={`
            w-full py-4 rounded-full font-semibold flex items-center justify-center gap-2
            transition-all duration-200 active:scale-[0.98]
            ${
              answeredCount === questions.length
                ? 'bg-brand-trust text-white active:bg-brand-trust-hover'
                : 'bg-neutral-100 text-neutral-600 active:bg-neutral-200'
            }
          `}
        >
          {t('complete')} ({answeredCount}/{questions.length} {t('answered')})
        </button>
      </div>
    </div>
  );
}
