'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface FlashcardProps {
  question: string;
  options: string[];
  correctIndex?: number;
  correctIndexes?: number[];
  type: 'single' | 'multiple';
  onSwipe: (direction: 'left' | 'right') => void;
  isLast: boolean;
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
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [slideOut, setSlideOut] = useState<'left' | 'right' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isNewCard, setIsNewCard] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTransitioning) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          setIsFlipped((prev) => !prev);
          break;
        case 'ArrowLeft':
          if (isFlipped) {
            // Only allow swipe if flipped? Or always? Design choice.
            // Usually swipe is available anytime, but for Flashcard often you flip then swipe.
            // Let's allow anytime for power users, matching drag behavior which works anytime?
            // Actually drag works anytime.
            // But buttons are only shown if isFlipped.
            // For safety, let's allow swipe provided it's not transitioning.
            setIsTransitioning(true);
            setIsFlipped(false);
            setSlideOut('left');
            onSwipe('left');
            setTimeout(() => {
              setIsTransitioning(false);
              setSlideOut(null);
              setDragOffset({ x: 0, y: 0 });
            }, 300);
          } else {
            // Should we force flip first?
            // If not flipped, "Don't Know" (Left) implies we don't know the answer.
            // "Know" (Right) implies we know it.
            // So we can arguably allow swipe without flip.
            // But let's stick to buttons visibility logic: Buttons only shown if flipped.
            // So maybe shortcuts should only work if flipped?
            // Or shortcuts flip the card if not flipped?
            if (e.code === 'ArrowLeft') {
              setIsFlipped(true); // Auto-flip on attempt to swipe?
            }
          }
          break;
        case 'ArrowRight':
          if (isFlipped) {
            setIsTransitioning(true);
            setIsFlipped(false);
            setSlideOut('right');
            onSwipe('right');
            setTimeout(() => {
              setIsTransitioning(false);
              setSlideOut(null);
              setDragOffset({ x: 0, y: 0 });
            }, 300);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, isTransitioning, onSwipe]);

  // Reset states when question changes (new card appears)
  useEffect(() => {
    setIsFlipped(false);
    setSlideOut(null);
    setIsTransitioning(false);
    setDragOffset({ x: 0, y: 0 });

    // Mark as new card and animate in
    setIsNewCard(true);
    const timer = setTimeout(() => {
      setIsNewCard(false);
    }, 50); // Small delay to trigger animation

    return () => clearTimeout(timer);
  }, [question]);

  // --- Swipe handlers ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isTransitioning) return;
    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    setDragOffset({ x: 0, y: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || isTransitioning) return;
    setDragOffset({ x: e.clientX - startPos.x, y: e.clientY - startPos.y });
  };

  const handleMouseUp = () => {
    if (!isDragging || isTransitioning) return;
    setIsDragging(false);

    if (Math.abs(dragOffset.x) > 100) {
      const direction = dragOffset.x > 0 ? 'right' : 'left';
      setIsTransitioning(true);
      setSlideOut(direction);

      // Call onSwipe immediately to start loading next card
      onSwipe(direction);

      // Reset states after animation completes
      setTimeout(() => {
        setIsTransitioning(false);
        setSlideOut(null);
        setIsFlipped(false);
        setDragOffset({ x: 0, y: 0 });
      }, 300);
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isTransitioning) return;
    const touch = e.touches[0];
    setIsDragging(true);
    setStartPos({ x: touch.clientX, y: touch.clientY });
    setDragOffset({ x: 0, y: 0 });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || isTransitioning) return;
    const touch = e.touches[0];
    setDragOffset({ x: touch.clientX - startPos.x, y: touch.clientY - startPos.y });
  };

  const handleTouchEnd = () => {
    if (!isDragging || isTransitioning) return;
    setIsDragging(false);

    if (Math.abs(dragOffset.x) > 100) {
      const direction = dragOffset.x > 0 ? 'right' : 'left';
      setIsTransitioning(true);
      setSlideOut(direction);

      // Call onSwipe immediately to start loading next card
      onSwipe(direction);

      // Reset states after animation completes
      setTimeout(() => {
        setIsTransitioning(false);
        setSlideOut(null);
        setIsFlipped(false);
        setDragOffset({ x: 0, y: 0 });
      }, 300);
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  // --- Answer helpers ---
  const getCorrectAnswers = () => {
    if (type === 'single' && typeof correctIndex === 'number') {
      return [options[correctIndex]];
    } else if (type === 'multiple' && correctIndexes) {
      return correctIndexes.map((index) => options[index]);
    }
    return [];
  };
  const getCorrectAnswerText = () => {
    const correctAnswers = getCorrectAnswers();
    if (type === 'single') {
      return correctAnswers[0] || t('noCorrectAnswer');
    } else {
      return correctAnswers.length > 0 ? correctAnswers.join(', ') : t('noCorrectAnswer');
    }
  };
  const getCorrectAnswerLetters = () => {
    if (type === 'single' && typeof correctIndex === 'number') {
      return String.fromCharCode(65 + correctIndex);
    } else if (type === 'multiple' && correctIndexes) {
      return correctIndexes.map((index) => String.fromCharCode(65 + index)).join(', ');
    }
    return 'N/A';
  };

  // --- Animation ---
  const getTransform = () => {
    if (slideOut) {
      return `translateX(${slideOut === 'right' ? '120vw' : '-120vw'})`;
    } else if (isDragging) {
      return `translate(${dragOffset.x}px, ${dragOffset.y}px)`;
    } else if (isNewCard) {
      // New card starts from center (no offset needed as it's mounting fresh)
      return 'translateX(0) scale(0.95)';
    } else {
      return 'translateX(0) scale(1)';
    }
  };

  const getOpacity = () => {
    if (slideOut) {
      return 0.8;
    } else if (isNewCard) {
      return 0.8;
    } else {
      return 1;
    }
  };

  const transform = getTransform();
  const opacity = getOpacity();
  const transition = slideOut
    ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out'
    : isDragging
      ? 'none'
      : isNewCard
        ? 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease-out'
        : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out';

  return (
    <div className="w-full flex flex-col items-center justify-center overflow-hidden">
      <button
        type="button"
        ref={cardRef}
        className="relative select-none border-0 bg-transparent p-0 text-left"
        aria-label={isFlipped ? t('showQuestion') : t('showAnswer')}
        style={{
          width: '75vw',
          maxWidth: '1000px',
          minWidth: '500px',
          height: '60vh',
          maxHeight: '500px',
          minHeight: '350px',
          margin: '0 auto',
          zIndex: 10,
          transform,
          opacity,
          transition,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => setIsFlipped(!isFlipped)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsFlipped(!isFlipped);
          }
        }}
      >
        <div
          className="relative w-full h-full cursor-pointer"
          style={{
            perspective: '1000px',
            transformStyle: 'preserve-3d',
          }}
        >
          <div
            className="relative w-full h-full transition-transform duration-300 ease-in-out"
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateX(180deg)' : 'rotateX(0deg)',
            }}
          >
            {/* Front Side */}
            <Card
              className="absolute w-full h-full flex flex-col justify-between items-center bg-white shadow-2xl rounded-2xl border-2 border-neutral-100"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              <CardContent className="flex flex-col h-full py-10 px-14 justify-between">
                <div className="flex-1 flex flex-col justify-center">
                  <h3 className="text-2xl font-semibold text-neutral-900 mb-8 text-center leading-relaxed break-words">
                    {question}
                  </h3>
                  <div className="space-y-4">
                    {options.map((option, index) => (
                      <div
                        key={option}
                        className="flex items-center gap-x-3 p-4 bg-neutral-50 rounded-lg border border-neutral-200 text-lg break-words"
                      >
                        <span className="text-lg font-medium text-neutral-600 w-6">
                          {String.fromCharCode(65 + index)}.
                        </span>
                        <span className="text-neutral-700 flex-1 break-words">{option}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Back Side */}
            <Card
              className="absolute w-full h-full flex flex-col justify-between items-center bg-white shadow-2xl rounded-2xl border-2 border-green-200"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateX(180deg)',
              }}
            >
              <CardContent className="flex flex-col h-full py-10 px-14 justify-between">
                <div className="flex-1 flex flex-col justify-center">
                  <h3 className="text-xl font-semibold text-green-700 mb-6 text-center">
                    {t('correctAnswer')}
                  </h3>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-center">
                    <span className="text-green-600 font-bold text-lg mr-2">
                      {getCorrectAnswerLetters()}
                    </span>
                    <span className="text-green-800 font-semibold text-lg break-words">
                      {getCorrectAnswerText()}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-neutral-900">{t('allAnswers')}</h4>
                    {options.map((option, index) => {
                      const isCorrect =
                        type === 'single'
                          ? typeof correctIndex === 'number' && index === correctIndex
                          : correctIndexes && correctIndexes.includes(index);
                      return (
                        <div
                          key={option}
                          className={`flex items-center space-x-3 p-3 rounded-lg border text-base break-words ${
                            isCorrect
                              ? 'bg-green-50 border-green-200'
                              : 'bg-neutral-50 border-neutral-200'
                          }`}
                        >
                          <span
                            className={`text-base font-medium w-6 ${
                              isCorrect ? 'text-green-600' : 'text-neutral-600'
                            }`}
                          >
                            {String.fromCharCode(65 + index)}.
                          </span>
                          <span
                            className={`flex-1 break-words ${
                              isCorrect ? 'text-green-800 font-medium' : 'text-neutral-700'
                            }`}
                          >
                            {option}
                          </span>
                          {isCorrect && (
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
          </div>
        </div>
      </button>

      {/* Know/Don't Know buttons - always reserve space */}
      <div className="flex justify-center gap-8 mt-8 mb-2 w-full h-12">
        {isFlipped && (
          <>
            <Button
              onClick={() => {
                if (isTransitioning) return;
                setIsTransitioning(true);
                setIsFlipped(false);
                setSlideOut('left');

                // Call onSwipe immediately to start loading next card
                onSwipe('left');

                // Reset states after animation completes
                setTimeout(() => {
                  setIsTransitioning(false);
                  setSlideOut(null);
                  setDragOffset({ x: 0, y: 0 });
                }, 300);
              }}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 px-8 py-3 text-lg rounded-full"
            >
              {t('dontKnow')}
            </Button>
            <Button
              onClick={() => {
                if (isTransitioning) return;
                setIsTransitioning(true);
                setIsFlipped(false);
                setSlideOut('right');

                // Call onSwipe immediately to start loading next card
                onSwipe('right');

                // Reset states after animation completes
                setTimeout(() => {
                  setIsTransitioning(false);
                  setSlideOut(null);
                  setDragOffset({ x: 0, y: 0 });
                }, 300);
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg rounded-full"
            >
              {t('knowIt')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
