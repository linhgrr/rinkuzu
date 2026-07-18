import { Schema, Types } from 'mongoose';
import {
  MAX_OPTION_COUNT,
  MAX_OPTION_TEXT_LENGTH,
  MAX_QUESTION_IMAGE_URL_LENGTH,
  MAX_QUESTION_TEXT_LENGTH,
  MIN_OPTION_COUNT,
} from '@/lib/validation/question';

interface QuizQuestionDocumentBase {
  _id: Types.ObjectId;
  question: string;
  options: string[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

export type QuizQuestionDocument = QuizQuestionDocumentBase &
  (
    | { type: 'single'; correctIndex: number; correctIndexes?: never }
    | { type: 'multiple'; correctIndex?: never; correctIndexes: number[] }
  );

export const QuizQuestionSchema = new Schema<QuizQuestionDocument>({
  question: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true,
    maxlength: [
      MAX_QUESTION_TEXT_LENGTH,
      `Question text cannot exceed ${MAX_QUESTION_TEXT_LENGTH} characters`,
    ],
  },
  options: {
    type: [String],
    required: [true, 'Options are required'],
    validate: [
      {
        validator: (options: string[]) =>
          options.length >= MIN_OPTION_COUNT && options.length <= MAX_OPTION_COUNT,
        message: 'Each question must have between 2 and 20 options',
      },
      {
        validator: (options: string[]) =>
          options.every(
            (option) => typeof option === 'string' && option.length <= MAX_OPTION_TEXT_LENGTH,
          ),
        message: `Option text cannot exceed ${MAX_OPTION_TEXT_LENGTH} characters`,
      },
    ],
  },
  type: {
    type: String,
    enum: ['single', 'multiple'],
    required: [true, 'Question type is required'],
  },
  correctIndex: {
    type: Number,
    required: function (this: QuizQuestionDocument) {
      return this.type === 'single';
    },
    validate: {
      validator: function (this: QuizQuestionDocument, value: number) {
        return (
          this.type !== 'single' ||
          (Number.isInteger(value) && value >= 0 && value < this.options.length)
        );
      },
      message: 'Single choice questions must have a valid correct index within options range',
    },
  },
  correctIndexes: {
    type: [Number],
    default: undefined,
    required: function (this: QuizQuestionDocument) {
      return this.type === 'multiple';
    },
    validate: {
      validator: function (this: QuizQuestionDocument, value: number[]) {
        return (
          this.type !== 'multiple' ||
          (value?.length > 0 &&
            value.every(
              (index) => Number.isInteger(index) && index >= 0 && index < this.options.length,
            ) &&
            new Set(value).size === value.length)
        );
      },
      message:
        'Multiple choice questions must have at least one valid correct index within options range',
    },
  },
  questionImage: {
    type: String,
    trim: true,
    maxlength: [
      MAX_QUESTION_IMAGE_URL_LENGTH,
      `Question image URL cannot exceed ${MAX_QUESTION_IMAGE_URL_LENGTH} characters`,
    ],
  },
  optionImages: {
    type: [String],
    default: undefined,
    validate: [
      {
        validator: function (this: QuizQuestionDocument, optionImages: (string | undefined)[]) {
          return (
            !optionImages ||
            optionImages.length === 0 ||
            optionImages.length === this.options.length
          );
        },
        message: 'Option images array length must match options array length',
      },
      {
        validator: (optionImages: (string | undefined)[]) => {
          if (!optionImages) return true;
          return optionImages.every(
            (image) =>
              image == null ||
              (typeof image === 'string' && image.length <= MAX_QUESTION_IMAGE_URL_LENGTH),
          );
        },
        message: `Option image URL cannot exceed ${MAX_QUESTION_IMAGE_URL_LENGTH} characters`,
      },
    ],
  },
});

QuizQuestionSchema.pre('validate', function validateQuizQuestionOptionContent() {
  const rawCorrectIndex = (this as { correctIndex?: number }).correctIndex;
  const rawCorrectIndexes = (this as { correctIndexes?: number[] }).correctIndexes;
  if (this.type === 'single' && rawCorrectIndexes !== undefined) {
    this.invalidate('correctIndexes', 'Single-choice question cannot have correctIndexes');
  }
  if (this.type === 'multiple' && rawCorrectIndex !== undefined) {
    this.invalidate('correctIndex', 'Multiple-choice question cannot have correctIndex');
  }

  this.options.forEach((option, index) => {
    const image = this.optionImages?.[index];
    if (
      (typeof option !== 'string' || option.trim().length === 0) &&
      !(typeof image === 'string' && image.trim().length > 0)
    ) {
      this.invalidate(`options.${index}`, 'Option requires text or an image');
    }
  });
});
