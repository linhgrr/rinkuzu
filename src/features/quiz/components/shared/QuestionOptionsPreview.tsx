'use client';

import Image from 'next/image';

interface QuestionOptionsPreviewProps {
  questionText?: string;
  options: string[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
  showOptionImages?: boolean;
  className?: string;
  questionClassName?: string;
  optionsClassName?: string;
  optionItemClassName?: string;
}

export function QuestionOptionsPreview({
  questionText,
  options,
  questionImage,
  optionImages,
  showOptionImages = false,
  className = '',
  questionClassName = 'font-medium',
  optionsClassName = 'text-sm mt-2 space-y-1',
  optionItemClassName = '',
}: QuestionOptionsPreviewProps) {
  return (
    <div className={className}>
      {questionText && <p className={questionClassName}>{questionText}</p>}

      {questionImage && (
        <div className="mt-3">
          <Image
            src={questionImage}
            alt="Question"
            width={480}
            height={200}
            unoptimized
            className="max-w-full h-auto rounded border"
            style={{ maxHeight: '200px' }}
          />
        </div>
      )}

      <div className={optionsClassName}>
        {options.map((option, index) => (
          <div
            key={`${String.fromCharCode(65 + index)}-${option}-${optionImages?.[index] ?? 'no-image'}`}
            className={optionItemClassName}
          >
            {String.fromCharCode(65 + index)}. {option}
            {showOptionImages && optionImages?.[index] && (
              <div className="mt-2">
                <Image
                  src={optionImages[index] as string}
                  alt={`Option ${String.fromCharCode(65 + index)}`}
                  width={480}
                  height={200}
                  unoptimized
                  className="max-w-full h-auto rounded border"
                  style={{ maxHeight: '200px' }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
