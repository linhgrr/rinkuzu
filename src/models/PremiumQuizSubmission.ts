import mongoose, { Schema, Types } from 'mongoose';
import { QuizQuestionSchema, type QuizQuestionDocument } from '@/models/schemas/QuizQuestionSchema';
import { PREMIUM_SUBMISSION_STATUSES } from '@/entities/PremiumQuiz';

interface PremiumQuizSnapshotDocument {
  title: string;
  slug: string;
  description?: string;
  questions: QuizQuestionDocument[];
}

interface PremiumDuplicateMatchDocument {
  submissionId: Types.ObjectId;
  quizId: Types.ObjectId;
  title: string;
  similarity: number;
  reason: 'exact_quiz' | 'shared_questions' | 'fuzzy';
}

interface PremiumDuplicateReportDocument {
  exactDocumentRewarded: boolean;
  exactQuiz: boolean;
  sharedQuestionCount: number;
  highestSimilarity: number;
  matches: PremiumDuplicateMatchDocument[];
}

interface PremiumReviewCriterionDocument {
  key: string;
  score: number;
  note: string;
}

interface PremiumReviewIssueDocument {
  questionIndex?: number;
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
}

interface PremiumReviewResultDocument {
  verdict: 'pass' | 'needs_review' | 'fail';
  score: number;
  suggestedCredits: number;
  groundingAvailable: boolean;
  summary: string;
  criteria: PremiumReviewCriterionDocument[];
  issues: PremiumReviewIssueDocument[];
}

export interface PremiumQuizSubmissionDocument {
  sourceQuiz: Types.ObjectId;
  author: Types.ObjectId;
  version: number;
  status: (typeof PREMIUM_SUBMISSION_STATUSES)[number];
  sourceType: 'pdf' | 'manual';
  rightsAttested: boolean;
  snapshot: PremiumQuizSnapshotDocument;
  snapshotHash: string;
  questionHashes: string[];
  documentFingerprint?: string;
  sourceObjectKey?: string;
  duplicateReport: PremiumDuplicateReportDocument;
  reviewStatus: 'not_started' | 'queued' | 'running' | 'completed' | 'failed';
  reviewJobId?: string;
  reviewSnapshotHash?: string;
  reviewResult?: PremiumReviewResultDocument;
  reviewError?: string;
  reviewer?: Types.ObjectId;
  reviewerNote?: string;
  overrideReason?: string;
  awardedCredits: number;
  active: boolean;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PremiumQuizSnapshotSchema = new Schema<PremiumQuizSnapshotDocument>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, trim: true, maxlength: 1000 },
    questions: { type: [QuizQuestionSchema], required: true },
  },
  { _id: false },
);

const PremiumDuplicateMatchSchema = new Schema<PremiumDuplicateMatchDocument>(
  {
    submissionId: { type: Schema.Types.ObjectId, required: true, ref: 'PremiumQuizSubmission' },
    quizId: { type: Schema.Types.ObjectId, required: true, ref: 'Quiz' },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    similarity: { type: Number, required: true, min: 0, max: 1 },
    reason: { type: String, required: true, enum: ['exact_quiz', 'shared_questions', 'fuzzy'] },
  },
  { _id: false },
);

const PremiumDuplicateReportSchema = new Schema<PremiumDuplicateReportDocument>(
  {
    exactDocumentRewarded: { type: Boolean, required: true, default: false },
    exactQuiz: { type: Boolean, required: true, default: false },
    sharedQuestionCount: { type: Number, required: true, default: 0, min: 0 },
    highestSimilarity: { type: Number, required: true, default: 0, min: 0, max: 1 },
    matches: { type: [PremiumDuplicateMatchSchema], required: true, default: [] },
  },
  { _id: false },
);

const PremiumReviewCriterionSchema = new Schema<PremiumReviewCriterionDocument>(
  {
    key: { type: String, required: true, trim: true, maxlength: 100 },
    score: { type: Number, required: true, min: 0, max: 100 },
    note: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { _id: false },
);

const PremiumReviewIssueSchema = new Schema<PremiumReviewIssueDocument>(
  {
    questionIndex: { type: Number, min: 0 },
    severity: { type: String, required: true, enum: ['info', 'warning', 'error'] },
    code: { type: String, required: true, trim: true, maxlength: 100 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { _id: false },
);

const PremiumReviewResultSchema = new Schema<PremiumReviewResultDocument>(
  {
    verdict: { type: String, required: true, enum: ['pass', 'needs_review', 'fail'] },
    score: { type: Number, required: true, min: 0, max: 100 },
    suggestedCredits: { type: Number, required: true, min: 1, max: 5 },
    groundingAvailable: { type: Boolean, required: true },
    summary: { type: String, required: true, trim: true, maxlength: 4000 },
    criteria: { type: [PremiumReviewCriterionSchema], required: true, default: [] },
    issues: { type: [PremiumReviewIssueSchema], required: true, default: [] },
  },
  { _id: false },
);

const PremiumQuizSubmissionSchema = new Schema<PremiumQuizSubmissionDocument>(
  {
    sourceQuiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true, immutable: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    version: { type: Number, required: true, min: 1, immutable: true },
    status: { type: String, enum: PREMIUM_SUBMISSION_STATUSES, required: true, default: 'pending' },
    sourceType: { type: String, enum: ['pdf', 'manual'], required: true, immutable: true },
    rightsAttested: { type: Boolean, required: true, immutable: true },
    snapshot: { type: PremiumQuizSnapshotSchema, required: true, immutable: true },
    snapshotHash: { type: String, required: true, match: /^[a-f0-9]{64}$/, immutable: true },
    questionHashes: { type: [String], required: true, immutable: true },
    documentFingerprint: { type: String, match: /^[a-f0-9]{64}$/, immutable: true },
    sourceObjectKey: { type: String, trim: true, maxlength: 1024, immutable: true },
    duplicateReport: { type: PremiumDuplicateReportSchema, required: true, immutable: true },
    reviewStatus: {
      type: String,
      enum: ['not_started', 'queued', 'running', 'completed', 'failed'],
      required: true,
      default: 'not_started',
    },
    reviewJobId: { type: String, trim: true, maxlength: 200 },
    reviewSnapshotHash: { type: String, match: /^[a-f0-9]{64}$/ },
    reviewResult: { type: PremiumReviewResultSchema },
    reviewError: { type: String, trim: true, maxlength: 4000 },
    reviewer: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewerNote: { type: String, trim: true, maxlength: 4000 },
    overrideReason: { type: String, trim: true, maxlength: 4000 },
    awardedCredits: { type: Number, required: true, default: 0, min: 0, max: 5 },
    active: { type: Boolean, required: true, default: false },
    decidedAt: { type: Date },
  },
  { timestamps: true },
);

PremiumQuizSubmissionSchema.index({ author: 1, createdAt: -1 });
PremiumQuizSubmissionSchema.index({ status: 1, createdAt: 1 });
PremiumQuizSubmissionSchema.index({ sourceQuiz: 1, version: 1 }, { unique: true });
PremiumQuizSubmissionSchema.index({ sourceQuiz: 1, snapshotHash: 1 }, { unique: true });
PremiumQuizSubmissionSchema.index({ snapshotHash: 1, status: 1 });
PremiumQuizSubmissionSchema.index({ questionHashes: 1, status: 1 });
PremiumQuizSubmissionSchema.index({ documentFingerprint: 1, status: 1 });
PremiumQuizSubmissionSchema.index(
  { sourceQuiz: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);

const PremiumQuizSubmissionModel =
  (mongoose.models['PremiumQuizSubmission'] as
    | mongoose.Model<PremiumQuizSubmissionDocument>
    | undefined) ??
  mongoose.model<PremiumQuizSubmissionDocument>(
    'PremiumQuizSubmission',
    PremiumQuizSubmissionSchema,
  );

export default PremiumQuizSubmissionModel;
