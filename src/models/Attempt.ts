import mongoose, { Schema, Types } from 'mongoose';
import type { SelectedAnswerPersistenceRecord } from '@/repositories/types/AnswerPersistence';
import { SelectedAnswerSchema } from '@/models/schemas/SelectedAnswerSchema';
import { QuizQuestionSchema, type QuizQuestionDocument } from '@/models/schemas/QuizQuestionSchema';
import { BLOG_POST_SLUG_PATTERN, TRACKED_QUIZ_ENTRIES } from '@/shared/constants/starter-quiz';

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
  /** SHA-256 hex of the guest's claim token (RIN-912). Never returned or logged. */
  guestClaimTokenHash?: string;
  claimedAt?: Date;
  idempotencyKey: string;
  submissionDigest: string;
  quiz: Types.ObjectId;
  premiumSubmission?: Types.ObjectId;
  premiumSnapshotHash?: string;
  quizSnapshot: AttemptQuizSnapshotDocument;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  answers: SelectedAnswerPersistenceRecord[];
  takenAt: Date;
  retryOfAttemptId?: Types.ObjectId;
  questionIndices?: number[];
  mode?: 'quick' | 'full';
  /** RIN-1256: where the attempt started; absent on attempts before it (count as `none`). */
  entry?: string;
  /** RIN-1256: blog post slug, only with `entry: 'blog'`. */
  post?: string;
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
  guestClaimTokenHash: {
    type: String,
    select: false,
    match: [/^[a-f0-9]{64}$/, 'Guest claim token hash must be a SHA-256 hex digest'],
  },
  claimedAt: {
    type: Date,
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
  premiumSubmission: {
    type: Schema.Types.ObjectId,
    ref: 'PremiumQuizSubmission',
    immutable: true,
  },
  premiumSnapshotHash: {
    type: String,
    match: [/^[a-f0-9]{64}$/, 'Premium snapshot hash must be a SHA-256 hex digest'],
    immutable: true,
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
  // Retry-missed attempts (RIN-914): optional and additive. `questionIndices[i]` is the quiz
  // question index answered by `answers[i]`; the snapshot already holds only those questions.
  retryOfAttemptId: {
    type: Schema.Types.ObjectId,
    ref: 'Attempt',
    immutable: true,
  },
  questionIndices: {
    type: [Number],
    default: undefined,
    immutable: true,
  },
  // Quick round (RIN-936): optional and additive; absent means a full attempt. A quick attempt
  // records `questionIndices` in play order and its snapshot holds only the played questions.
  mode: {
    type: String,
    enum: ['quick', 'full'],
    immutable: true,
  },
  // Attribution (RIN-1256): optional and additive, no backfill. A claim keeps both.
  entry: {
    type: String,
    enum: [...TRACKED_QUIZ_ENTRIES],
    immutable: true,
  },
  post: {
    type: String,
    match: BLOG_POST_SLUG_PATTERN,
    immutable: true,
  },
});

AttemptSchema.pre('validate', function validateIdentity() {
  // Exactly one owner: a user, a legacy guest email, or a guest claim-token hash.
  // A claimed attempt (RIN-912 part 3) has `user` + `claimedAt` and no hash.
  const owners = [this.user, this.guestEmail, this.guestClaimTokenHash].filter(Boolean).length;
  if (owners !== 1) {
    this.invalidate('user', 'Exactly one attempt identity is required');
  }
  if (this.claimedAt && !this.user) {
    this.invalidate('claimedAt', 'Only a user-owned attempt can be claimed');
  }
});

AttemptSchema.pre('validate', function validateRetryContract() {
  const indices = this.questionIndices;
  const isQuick = this.mode === 'quick';
  if (isQuick && this.retryOfAttemptId) {
    this.invalidate('questionIndices', 'A quick round cannot record retryOfAttemptId');
    return;
  }
  if (Boolean(this.retryOfAttemptId) !== Boolean(indices) && !isQuick) {
    this.invalidate(
      'questionIndices',
      'Retry attempts record retryOfAttemptId and questionIndices',
    );
    return;
  }
  if (isQuick) {
    const unique =
      indices?.every(isNonNegativeInteger) === true && new Set(indices).size === indices.length;
    if (!indices || !unique || indices.length !== this.answers.length) {
      this.invalidate(
        'questionIndices',
        'Quick rounds record unique questionIndices, one per answer',
      );
    }
    return;
  }
  if (!indices) return;
  const ascendingUnique = indices.every(
    (value, index) =>
      isNonNegativeInteger(value) && (index === 0 || value > (indices[index - 1] ?? -1)),
  );
  if (!ascendingUnique || indices.length !== this.answers.length) {
    this.invalidate(
      'questionIndices',
      'questionIndices must be ascending unique indices, one per answer',
    );
  }
});

AttemptSchema.pre('validate', function validateSubmissionContract() {
  if (Boolean(this.premiumSubmission) !== Boolean(this.premiumSnapshotHash)) {
    this.invalidate(
      'premiumSubmission',
      'Premium submission and snapshot hash must be recorded together',
    );
  }
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
AttemptSchema.index({ premiumSubmission: 1, takenAt: -1 });
AttemptSchema.index({ user: 1, quiz: 1 });
AttemptSchema.index({ takenAt: -1 });
AttemptSchema.index(
  { user: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      user: { $type: 'objectId' },
      idempotencyKey: { $type: 'string' },
    },
  },
);
AttemptSchema.index(
  { guestEmail: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      guestEmail: { $type: 'string' },
      idempotencyKey: { $type: 'string' },
    },
  },
);

AttemptSchema.index(
  { guestClaimTokenHash: 1 },
  {
    unique: true,
    partialFilterExpression: { guestClaimTokenHash: { $type: 'string' } },
  },
);
AttemptSchema.index(
  { guestClaimTokenHash: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      guestClaimTokenHash: { $type: 'string' },
      idempotencyKey: { $type: 'string' },
    },
  },
);

const Attempt =
  (mongoose.models['Attempt'] as mongoose.Model<AttemptDocument> | undefined) ??
  mongoose.model<AttemptDocument>('Attempt', AttemptSchema);

export default Attempt;
