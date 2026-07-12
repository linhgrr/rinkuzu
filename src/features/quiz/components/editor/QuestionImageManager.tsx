'use client';

import { QuestionImageUpload, OptionImageUpload } from '@/components/ui/ImageUpload';

interface QuestionImageManagerProps {
  questionImage?: string;
  optionImages?: (string | undefined)[];
  /** Always drive from options.length so new questions get answer-image slots. */
  optionCount: number;
  onQuestionImageUploaded: (url: string) => void;
  onQuestionImageRemoved: () => void;
  onOptionImageUploaded: (optIdx: number, url: string) => void;
  onOptionImageRemoved: (optIdx: number) => void;
}

/**
 * Renders image upload controls for a single question:
 * - One question-level image upload
 * - One image upload per option (single- and multi-answer MCQ)
 */
export function QuestionImageManager({
  questionImage,
  optionImages,
  optionCount,
  onQuestionImageUploaded,
  onQuestionImageRemoved,
  onOptionImageUploaded,
  onOptionImageRemoved,
}: QuestionImageManagerProps) {
  return (
    <div className="space-y-3">
      <QuestionImageUpload
        currentImage={questionImage}
        onImageUploaded={onQuestionImageUploaded}
        onImageRemoved={onQuestionImageRemoved}
      />
      {Array.from({ length: optionCount }).map((_, optIdx) => (
        <div key={optIdx} className="ml-8">
          <OptionImageUpload
            currentImage={optionImages?.[optIdx]}
            onImageUploaded={(url: string) => onOptionImageUploaded(optIdx, url)}
            onImageRemoved={() => onOptionImageRemoved(optIdx)}
          />
        </div>
      ))}
    </div>
  );
}
