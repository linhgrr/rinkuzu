'use client';

import { QuestionImage, OptionImage } from '@/components/ui/ImageDisplay';
import { QuestionContent } from '@/components/ui/QuestionContent';

interface QuestionOptionsPreviewProps {
  questionText?: string;
  options: string[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
  correctIndexes?: readonly number[];
  correctLabel?: string;
  showOptionImages?: boolean;
  className?: string;
  questionClassName?: string;
  optionsClassName?: string;
  optionItemClassName?: string;
  highlightedOptionItemClassName?: string;
}

const EMPTY_CORRECT_INDEXES: readonly number[] = [];

export function QuestionOptionsPreview({
  questionText,
  options,
  questionImage,
  optionImages,
  correctIndexes = EMPTY_CORRECT_INDEXES,
  correctLabel,
  showOptionImages = false,
  className = '',
  questionClassName = 'font-medium',
  optionsClassName = 'text-sm mt-2 space-y-1',
  optionItemClassName = '',
  highlightedOptionItemClassName = optionItemClassName,
}: QuestionOptionsPreviewProps) {
  const correctIndexSet = new Set(correctIndexes);
  const optionOccurrences = new Map<string, number>();

  return (
    <div className={className}>
      {questionText && (
        <QuestionContent content={questionText} variant="compact" className={questionClassName} />
      )}

      {questionImage && (
        <div className="mt-3">
          <QuestionImage src={questionImage} alt="Question" />
        </div>
      )}

      <div className={optionsClassName}>
        {options.map((option, index) => {
          const optionLabel = String.fromCharCode(65 + index);
          const occurrence = optionOccurrences.get(option) ?? 0;
          optionOccurrences.set(option, occurrence + 1);
          const isCorrect = correctIndexSet.has(index);

          return (
            <div
              key={`${optionLabel}-${option}-${optionImages?.[index] ?? 'no-image'}-${occurrence}`}
              className={isCorrect ? highlightedOptionItemClassName : optionItemClassName}
            >
              <div className="flex items-start gap-x-3">
                <div
                  className={`mt-0.5 flex size-4 flex-shrink-0 items-center justify-center rounded border-2 ${
                    isCorrect ? 'border-green-500 bg-green-500' : 'border-control-border'
                  }`}
                >
                  {isCorrect ? (
                    <svg
                      className="size-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    className={
                      isCorrect
                        ? 'flex items-start gap-1 font-medium text-green-800'
                        : 'flex items-start gap-1'
                    }
                  >
                    <span className="flex-shrink-0">{optionLabel}.</span>
                    <QuestionContent content={option} variant="option" className="min-w-0 flex-1" />
                  </div>
                  {showOptionImages && optionImages?.[index] && (
                    <div className="mt-2">
                      <OptionImage src={optionImages[index]} alt={`Option ${optionLabel}`} />
                    </div>
                  )}
                </div>

                {isCorrect && correctLabel ? (
                  <span className="ml-auto text-sm font-medium text-green-600">
                    ✓ {correctLabel}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
