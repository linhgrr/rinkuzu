import { Schema } from 'mongoose';

export interface SelectedAnswerSchemaRecord {
  kind: 'single' | 'multiple';
  selectedIndex?: number | null;
  selectedIndexes?: number[];
}

export const SelectedAnswerSchema = new Schema<SelectedAnswerSchemaRecord>(
  {
    kind: {
      type: String,
      enum: ['single', 'multiple'],
      required: true,
    },
    selectedIndex: {
      type: Number,
      default: null,
      min: 0,
    },
    selectedIndexes: {
      type: [Number],
      default: undefined,
      validate: {
        validator(indexes: number[] | undefined) {
          return (
            indexes === undefined || indexes.every((index) => Number.isInteger(index) && index >= 0)
          );
        },
        message: 'Selected answer contains an invalid option index',
      },
    },
  },
  { _id: false },
);

SelectedAnswerSchema.pre('validate', function validateSelectedAnswer() {
  if (this.kind === 'single') {
    if (this.selectedIndexes !== undefined) {
      this.invalidate('selectedIndexes', 'Single-choice answer cannot have selectedIndexes');
    }
    return;
  }

  if (this.selectedIndex !== null && this.selectedIndex !== undefined) {
    this.invalidate('selectedIndex', 'Multiple-choice answer cannot have selectedIndex');
  }
  if (!Array.isArray(this.selectedIndexes)) {
    this.invalidate('selectedIndexes', 'Multiple-choice answer requires selectedIndexes');
  }
});
