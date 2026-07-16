import { Schema, Types } from 'mongoose';

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
  },
  options: {
    type: [String],
    required: [true, 'Options are required'],
    validate: {
      validator: (options: string[]) => options.length >= 2 && options.length <= 20,
      message: 'Each question must have between 2 and 20 options',
    },
  },
  type: {
    type: String,
    enum: ['single', 'multiple'],
    default: 'single',
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
  },
  optionImages: {
    type: [String],
    default: undefined,
    validate: {
      validator: function (this: QuizQuestionDocument, optionImages: (string | undefined)[]) {
        return (
          !optionImages || optionImages.length === 0 || optionImages.length === this.options.length
        );
      },
      message: 'Option images array length must match options array length',
    },
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
