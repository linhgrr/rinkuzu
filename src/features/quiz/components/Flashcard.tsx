'use client';

import { useEffect, useReducer } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/Card';
import { QuestionContent } from '@/components/ui/QuestionContent';
import { toStableContentEntries } from '@/lib/collections/stable-content-entries';
import { Button } from '@/components/ui/Button';
import { formatCorrectAnswerLetters, getCorrectAnswerOptions } from '@/lib/quiz/answer-text';
import type { QuestionType } from '@/shared/constants/question-type';

type SwipeDirection = 'left' | 'right';

interface FlashcardProps {
  question: string;
  options: string[];
  correctIndex?: number;
  correctIndexes?: number[];
  type: QuestionType;
  onSwipe: (direction: SwipeDirection) => void;
  isLast: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface FlashcardState {
  isFlipped: boolean;
  isDragging: boolean;
  dragOffset: Point;
  startPos: Point;
  slideOut: SwipeDirection | null;
  isTransitioning: boolean;
  isNewCard: boolean;
}

interface CorrectOptionInput extends Pick<
  FlashcardProps,
  'correctIndex' | 'correctIndexes' | 'type'
> {
  index: number;
}

type FlashcardFrontProps = Pick<FlashcardProps, 'options' | 'question'>;

interface FlashcardBackProps extends Pick<
  FlashcardProps,
  'correctIndex' | 'correctIndexes' | 'options' | 'type'
> {
  correctAnswerLetters: string;
  correctAnswers: string[];
  t: ReturnType<typeof useTranslations>;
}

interface FlashcardActionsProps {
  canSwipe: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  t: ReturnType<typeof useTranslations>;
}

type FlashcardAction =
  | { type: 'toggleFlipped' }
  | { type: 'setFlipped'; value: boolean }
  | { type: 'dragStart'; point: Point }
  | { type: 'dragMove'; offset: Point }
  | { type: 'dragCancel' }
  | { type: 'swipeStart'; direction: SwipeDirection }
  | { type: 'swipeFinish' }
  | { type: 'resetForQuestion' }
  | { type: 'clearNewCard' };

const zeroPoint: Point = { x: 0, y: 0 };

const initialFlashcardState: FlashcardState = {
  isFlipped: false,
  isDragging: false,
  dragOffset: zeroPoint,
  startPos: zeroPoint,
  slideOut: null,
  isTransitioning: false,
  isNewCard: false,
};

function flashcardReducer(state: FlashcardState, action: FlashcardAction): FlashcardState {
  switch (action.type) {
    case 'toggleFlipped':
      return { ...state, isFlipped: !state.isFlipped };
    case 'setFlipped':
      return { ...state, isFlipped: action.value };
    case 'dragStart':
      return {
        ...state,
        isDragging: true,
        startPos: action.point,
        dragOffset: zeroPoint,
      };
    case 'dragMove':
      return {
        ...state,
        dragOffset: action.offset,
      };
    case 'dragCancel':
      return {
        ...state,
        isDragging: false,
        dragOffset: zeroPoint,
      };
    case 'swipeStart':
      return {
        ...state,
        isDragging: false,
        isFlipped: false,
        isTransitioning: true,
        slideOut: action.direction,
      };
    case 'swipeFinish':
      return {
        ...state,
        isTransitioning: false,
        slideOut: null,
        dragOffset: zeroPoint,
      };
    case 'resetForQuestion':
      return {
        ...initialFlashcardState,
        isNewCard: true,
      };
    case 'clearNewCard':
      return {
        ...state,
        isNewCard: false,
      };
    default:
      return state;
  }
}

function isCorrectOption({ correctIndex, correctIndexes, index, type }: CorrectOptionInput) {
  return type === 'single'
    ? typeof correctIndex === 'number' && index === correctIndex
    : Boolean(correctIndexes?.includes(index));
}

function getAnimatedCardStyle(state: FlashcardState) {
  if (state.slideOut) {
    return {
      transform: `translateX(${state.slideOut === 'right' ? '120vw' : '-120vw'})`,
      opacity: 0.8,
      transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out',
    };
  }

  if (state.isDragging) {
    return {
      transform: `translate(${state.dragOffset.x}px, ${state.dragOffset.y}px)`,
      opacity: 1,
      transition: 'none',
    };
  }

  if (state.isNewCard) {
    return {
      transform: 'translateX(0) scale(0.95)',
      opacity: 0.8,
      transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease-out',
    };
  }

  return {
    transform: 'translateX(0) scale(1)',
    opacity: 1,
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out',
  };
}

function FlashcardFront({ options, question }: FlashcardFrontProps) {
  return (
    <Card className="absolute w-full h-full flex flex-col justify-between items-center bg-white shadow-2xl rounded-2xl border-2 border-neutral-100 [backface-visibility:hidden] [-webkit-backface-visibility:hidden]">
      <CardContent className="flex flex-col h-full py-10 px-14 justify-between">
        <div className="flex-1 flex flex-col justify-center">
          <QuestionContent
            content={question}
            headingLevel={3}
            className="mb-8 break-words text-center text-2xl font-semibold leading-relaxed text-neutral-900"
          />
          <div className="space-y-4">
            {options.map((option, index) => (
              <div
                key={option}
                className="flex items-center gap-x-3 p-4 bg-neutral-50 rounded-lg border border-neutral-200 text-lg break-words"
              >
                <span className="text-lg font-medium text-neutral-600 w-6">
                  {String.fromCharCode(65 + index)}.
                </span>
                <QuestionContent
                  content={option}
                  variant="option"
                  className="min-w-0 flex-1 break-words text-lg text-neutral-700"
                />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FlashcardBack({
  correctAnswerLetters,
  correctAnswers,
  correctIndex,
  correctIndexes,
  options,
  t,
  type,
}: FlashcardBackProps) {
  return (
    <Card className="absolute w-full h-full flex flex-col justify-between items-center bg-white shadow-2xl rounded-2xl border-2 border-green-200 [backface-visibility:hidden] [-webkit-backface-visibility:hidden] [transform:rotateX(180deg)]">
      <CardContent className="flex flex-col h-full py-10 px-14 justify-between">
        <div className="flex-1 flex flex-col justify-center">
          <h3 className="text-xl font-semibold text-green-700 mb-6 text-center">
            {t('correctAnswer')}
          </h3>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-center">
            <span className="text-green-600 font-bold text-lg mr-2">{correctAnswerLetters}</span>
            <div className="min-w-0 flex-1 space-y-1">
              {toStableContentEntries(correctAnswers).map(({ content: answer, key }) => (
                <QuestionContent
                  key={key}
                  content={answer}
                  variant="answer"
                  className="break-words text-lg font-semibold text-green-800"
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-neutral-900">{t('allAnswers')}</h4>
            {options.map((option, index) => {
              const correct = isCorrectOption({
                ...(correctIndex !== undefined ? { correctIndex } : {}),
                ...(correctIndexes !== undefined ? { correctIndexes } : {}),
                index,
                type,
              });

              return (
                <div
                  key={option}
                  className={`flex items-center gap-x-3 p-3 rounded-lg border text-base break-words ${correct ? 'bg-green-50 border-green-200' : 'bg-neutral-50 border-neutral-200'}`}
                >
                  <span
                    className={`text-base font-medium w-6 ${correct ? 'text-green-600' : 'text-neutral-600'}`}
                  >
                    {String.fromCharCode(65 + index)}.
                  </span>
                  <QuestionContent
                    content={option}
                    variant="option"
                    className={`min-w-0 flex-1 break-words ${
                      correct ? 'font-medium text-green-800' : 'text-neutral-700'
                    }`}
                  />
                  {correct && (
                    <span className="text-green-600" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FlashcardActions({ canSwipe, onSwipeLeft, onSwipeRight, t }: FlashcardActionsProps) {
  return (
    <div className="flex justify-center gap-8 mt-8 mb-2 w-full h-12">
      {canSwipe && (
        <>
          <Button
            onClick={onSwipeLeft}
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50 px-8 py-3 text-lg rounded-full"
          >
            {t('dontKnow')}
          </Button>
          <Button
            onClick={onSwipeRight}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg rounded-full"
          >
            {t('knowIt')}
          </Button>
        </>
      )}
    </div>
  );
}

export function Flashcard({
  question,
  options,
  correctIndex,
  correctIndexes,
  type,
  onSwipe,
  isLast: _isLast,
}: FlashcardProps) {
  const t = useTranslations('flashcard');
  const [state, dispatch] = useReducer(flashcardReducer, initialFlashcardState);
  const correctAnswers = getCorrectAnswerOptions({
    ...(correctIndex !== undefined ? { correctIndex } : {}),
    ...(correctIndexes !== undefined ? { correctIndexes } : {}),
    options,
    type,
  });
  if (correctAnswers.length === 0) {
    correctAnswers.push(t('noCorrectAnswer'));
  }
  const correctAnswerLetters = formatCorrectAnswerLetters(
    {
      ...(correctIndex !== undefined ? { correctIndex } : {}),
      ...(correctIndexes !== undefined ? { correctIndexes } : {}),
      type,
    },
    'N/A',
  );
  const animatedCardStyle = getAnimatedCardStyle(state);

  const triggerSwipe = (direction: SwipeDirection) => {
    if (state.isTransitioning) {
      return;
    }

    dispatch({ type: 'swipeStart', direction });
    onSwipe(direction);
    window.setTimeout(() => {
      dispatch({ type: 'swipeFinish' });
    }, 300);
  };

  useHotkeys(
    'space',
    (event) => {
      if (state.isTransitioning) return;
      event.preventDefault();
      dispatch({ type: 'toggleFlipped' });
    },
    { preventDefault: true },
    [state.isTransitioning],
  );

  useHotkeys(
    'left',
    () => {
      if (state.isTransitioning) return;
      if (state.isFlipped) {
        triggerSwipe('left');
      } else {
        dispatch({ type: 'setFlipped', value: true });
      }
    },
    [state.isTransitioning, state.isFlipped, triggerSwipe],
  );

  useHotkeys(
    'right',
    () => {
      if (state.isTransitioning) return;
      if (state.isFlipped) {
        triggerSwipe('right');
      }
    },
    [state.isTransitioning, state.isFlipped, triggerSwipe],
  );

  useEffect(() => {
    dispatch({ type: 'resetForQuestion' });
    const timer = window.setTimeout(() => {
      dispatch({ type: 'clearNewCard' });
    }, 50);

    return () => window.clearTimeout(timer);
  }, [question]);

  const handleDragStart = (point: Point) => {
    if (state.isTransitioning) {
      return;
    }

    dispatch({ type: 'dragStart', point });
  };

  const handleDragMove = (point: Point) => {
    if (!state.isDragging || state.isTransitioning) {
      return;
    }

    dispatch({
      type: 'dragMove',
      offset: {
        x: point.x - state.startPos.x,
        y: point.y - state.startPos.y,
      },
    });
  };

  const handleDragEnd = () => {
    if (!state.isDragging || state.isTransitioning) {
      return;
    }

    if (Math.abs(state.dragOffset.x) > 100) {
      triggerSwipe(state.dragOffset.x > 0 ? 'right' : 'left');
      return;
    }

    dispatch({ type: 'dragCancel' });
  };

  return (
    <div className="w-full flex flex-col items-center justify-center overflow-hidden">
      <button
        type="button"
        className="relative select-none border-0 bg-transparent p-0 text-left w-[75vw] max-w-[1000px] min-w-[500px] h-[60vh] max-h-[500px] min-h-[350px] mx-auto z-10"
        aria-label={state.isFlipped ? t('showQuestion') : t('showAnswer')}
        style={animatedCardStyle}
        onMouseDown={(event) => handleDragStart({ x: event.clientX, y: event.clientY })}
        onMouseMove={(event) => handleDragMove({ x: event.clientX, y: event.clientY })}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          if (!touch) return;
          handleDragStart({ x: touch.clientX, y: touch.clientY });
        }}
        onTouchMove={(event) => {
          const touch = event.touches[0];
          if (!touch) return;
          handleDragMove({ x: touch.clientX, y: touch.clientY });
        }}
        onTouchEnd={handleDragEnd}
        onClick={() => {
          if (!state.isTransitioning) {
            dispatch({ type: 'toggleFlipped' });
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!state.isTransitioning) {
              dispatch({ type: 'toggleFlipped' });
            }
          }
        }}
      >
        <div className="relative w-full h-full cursor-pointer [perspective:1000px] [transform-style:preserve-3d]">
          <div
            className="relative w-full h-full transition-transform duration-300 ease-in-out [transform-style:preserve-3d]"
            style={{ transform: state.isFlipped ? 'rotateX(180deg)' : 'rotateX(0deg)' }}
          >
            <FlashcardFront options={options} question={question} />
            <FlashcardBack
              correctAnswerLetters={correctAnswerLetters}
              correctAnswers={correctAnswers}
              {...(correctIndex !== undefined ? { correctIndex } : {})}
              {...(correctIndexes !== undefined ? { correctIndexes } : {})}
              options={options}
              t={t}
              type={type}
            />
          </div>
        </div>
      </button>

      <FlashcardActions
        canSwipe={state.isFlipped}
        onSwipeLeft={() => triggerSwipe('left')}
        onSwipeRight={() => triggerSwipe('right')}
        t={t}
      />
    </div>
  );
}
