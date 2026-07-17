import mongoose, { Schema, Types } from 'mongoose';
import type { SelectedAnswerPersistenceRecord } from '@/repositories/types/AnswerPersistence';
import { SelectedAnswerSchema } from '@/models/schemas/SelectedAnswerSchema';
import { QuizQuestionSchema, type QuizQuestionDocument } from '@/models/schemas/QuizQuestionSchema';

interface AttemptQuizSnapshotDocument {
  integrity: 'complete';
  title: string;
  slug: string;
  description?: string;
  questions: QuizQuestionDocument[];
}

interface AttemptDocument {
  user?: Types.ObjectId;
  guestEmail?: string;
  idempotencyKey: string;
  submissionDigest: string;
  quiz: Types.ObjectId;
  quizSnapshot: AttemptQuizSnapshotDocument;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  answers: SelectedAnswerPersistenceRecord[];
  takenAt: Date;
}

const AttemptQuizSnapshotSchema = new Schema<AttemptQuizSnapshotDocument>(
  {
    integrity: {
      type: String,
      enum: ['complete'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    questions: {
      type: [QuizQuestionSchema],
      required: true,
      validate: {
        validator: (questions: QuizQuestionDocument[]) => questions.length > 0,
        message: 'Quiz snapshots require at least one question',
      },
    },
  },
  { _id: false },
);

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function sameIndexSet(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const sortedLeft = left.toSorted((a, b) => a - b);
  const sortedRight = right.toSorted((a, b) => a - b);
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function isIndexWithinOptions(index: number, optionCount: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < optionCount;
}

const AttemptSchema = new Schema<AttemptDocument>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  guestEmail: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Guest email is invalid'],
  },
  idempotencyKey: {
    type: String,
    required: [true, 'Idempotency key is required'],
    immutable: true,
    minlength: 16,
    maxlength: 128,
  },
  submissionDigest: {
    type: String,
    required: [true, 'Submission digest is required'],
    immutable: true,
    match: [/^[a-f0-9]{64}$/, 'Submission digest must be a SHA-256 hex digest'],
  },
  quiz: {
    type: Schema.Types.ObjectId,
    ref: 'Quiz',
    required: [true, 'Quiz is required'],
  },
  quizSnapshot: {
    type: AttemptQuizSnapshotSchema,
    required: [true, 'Quiz snapshot is required'],
    immutable: true,
  },
  score: {
    type: Number,
    required: [true, 'Score is required'],
    min: [0, 'Score cannot be negative'],
    max: [100, 'Score cannot exceed 100'],
  },
  correctAnswers: {
    type: Number,
    required: [true, 'Correct answer count is required'],
    min: [0, 'Correct answer count cannot be negative'],
    validate: {
      validator: Number.isInteger,
      message: 'Correct answer count must be an integer',
    },
  },
  totalQuestions: {
    type: Number,
    required: [true, 'Total questions is required'],
    min: [1, 'Total questions must be positive'],
    validate: {
      validator: Number.isInteger,
      message: 'Total questions must be an integer',
    },
  },
  answers: {
    type: [SelectedAnswerSchema],
    required: [true, 'Answers are required'],
  },
  takenAt: {
    type: Date,
    default: Date.now,
  },
});

AttemptSchema.pre('validate', function validateIdentity() {
  if (Boolean(this.user) === Boolean(this.guestEmail)) {
    this.invalidate('user', 'Exactly one attempt identity is required');
  }
});

AttemptSchema.pre('validate', function validateSubmissionContract() {
  const questions = this.quizSnapshot?.questions;
  const questionCount = questions?.length;
  const totalQuestionsValid = isPositiveInteger(this.totalQuestions);
  const correctAnswersValid = isNonNegativeInteger(this.correctAnswers);

  if (totalQuestionsValid && questionCount !== this.totalQuestions) {
    this.invalidate('totalQuestions', 'Total questions must match the immutable quiz snapshot');
  }

  if (totalQuestionsValid && this.answers.length !== this.totalQuestions) {
    this.invalidate('answers', 'Answer count must match total questions');
  }

  if (correctAnswersValid && totalQuestionsValid && this.correctAnswers > this.totalQuestions) {
    this.invalidate('correctAnswers', 'Correct answer count cannot exceed total questions');
  }

  const canEvaluateAnswers =
    Array.isArray(questions) &&
    questions.length > 0 &&
    totalQuestionsValid &&
    this.totalQuestions === questions.length &&
    this.answers.length === questions.length;

  if (!canEvaluateAnswers) {
    return;
  }

  let computedCorrect = 0;
  let answersValid = true;

  for (let questionIndex = 0; questionIndex < questions.length; questionIndex += 1) {
    const question = questions[questionIndex];
    const answer = this.answers[questionIndex];
    if (question === undefined || answer === undefined) {
      answersValid = false;
      this.invalidate(`answers.${questionIndex}`, 'Answer is missing for quiz snapshot question');
      continue;
    }

    const optionCount = question.options.length;

    if (answer.kind !== question.type) {
      answersValid = false;
      this.invalidate(
        `answers.${questionIndex}.kind`,
        'Answer kind must match the quiz snapshot question type',
      );
      continue;
    }

    if (question.type === 'single' && answer.kind === 'single') {
      const selectedIndex = answer.selectedIndex;
      if (selectedIndex !== null) {
        if (!isIndexWithinOptions(selectedIndex, optionCount)) {
          answersValid = false;
          this.invalidate(
            `answers.${questionIndex}.selectedIndex`,
            'Single-choice selectedIndex must be null or an integer within options range',
          );
          continue;
        }
      }

      if (selectedIndex !== null && selectedIndex === question.correctIndex) {
        computedCorrect += 1;
      }
      continue;
    }

    if (question.type === 'multiple' && answer.kind === 'multiple') {
      const selectedIndexes = answer.selectedIndexes;
      if (!Array.isArray(selectedIndexes)) {
        answersValid = false;
        this.invalidate(
          `answers.${questionIndex}.selectedIndexes`,
          'Multiple-choice selectedIndexes must be unique integers within options range',
        );
        continue;
      }

      const hasInvalidIndex = selectedIndexes.some(
        (index) => !isIndexWithinOptions(index, optionCount),
      );
      const hasDuplicates = new Set(selectedIndexes).size !== selectedIndexes.length;
      if (hasInvalidIndex || hasDuplicates) {
        answersValid = false;
        this.invalidate(
          `answers.${questionIndex}.selectedIndexes`,
          'Multiple-choice selectedIndexes must be unique integers within options range',
        );
        continue;
      }

      if (sameIndexSet(selectedIndexes, question.correctIndexes)) {
        computedCorrect += 1;
      }
      continue;
    }

    answersValid = false;
    this.invalidate(
      `answers.${questionIndex}`,
      'Persisted answer shape must match the quiz snapshot question',
    );
  }

  if (!answersValid || !correctAnswersValid) {
    return;
  }

  if (this.correctAnswers !== computedCorrect) {
    this.invalidate('correctAnswers', 'Correct answer count must match evaluated answers');
  }

  const expectedScore = Math.round((computedCorrect / this.totalQuestions) * 100);
  if (this.score !== expectedScore) {
    this.invalidate('score', 'Score must match the correct answer count');
  }
});

AttemptSchema.index({ user: 1, takenAt: -1 });
AttemptSchema.index({ guestEmail: 1, takenAt: -1 });
AttemptSchema.index({ quiz: 1, takenAt: -1 });
AttemptSchema.index({ user: 1, quiz: 1 });
AttemptSchema.index({ takenAt: -1 });
AttemptSchema.index(
  { user: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { user: { $type: 'objectId' } },
  },
);
AttemptSchema.index(
  { guestEmail: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { guestEmail: { $type: 'string' } },
  },
);

const Attempt =
  (mongoose.models['Attempt'] as mongoose.Model<AttemptDocument> | undefined) ??
  mongoose.model<AttemptDocument>('Attempt', AttemptSchema);

export default Attempt;
