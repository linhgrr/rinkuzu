import mongoose, { Schema, Types } from 'mongoose';

/**
 * One collection's fields, stated once for the two persistence-layer views of
 * it: the schema below, which spells ids as `Types.ObjectId`, and
 * PremiumPlaySessionPersistenceRecord in src/repositories/types, which spells
 * them as MongoIdLike. Both are inside the persistence layer, so the
 * three-layer standard's "do not derive one from another" rule does not apply
 * here — that rule is about DTO/Entity/Persistence echoes, which must stay
 * independent so the layers can move apart. These two cannot move apart: they
 * describe the same documents, and a field added to one and not the other is a
 * bug no type checker was catching.
 */
interface PremiumSessionAnswerFields {
  questionIndex: number;
  selectedIndex?: number;
  selectedIndexes?: number[];
}

export interface PremiumPlaySessionFields<TId> {
  user: TId;
  quiz: TId;
  submission: TId;
  snapshotHash: string;
  answers: PremiumSessionAnswerFields[];
  currentQuestionIndex: number;
  highestBatch: number;
  sessionCode: string;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  purgeAt: Date;
  batchWindowStartedAt: Date;
  batchRequestCount: number;
  submissionIdempotencyKey?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

type PremiumPlaySessionDocument = PremiumPlaySessionFields<Types.ObjectId>;

const StoredAnswerSchema = new Schema<PremiumSessionAnswerFields>(
  {
    questionIndex: { type: Number, required: true, min: 0 },
    selectedIndex: { type: Number, min: -1 },
    selectedIndexes: { type: [Number] },
  },
  { _id: false },
);

const PremiumPlaySessionSchema = new Schema<PremiumPlaySessionDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true, immutable: true },
    submission: {
      type: Schema.Types.ObjectId,
      ref: 'PremiumQuizSubmission',
      required: true,
      immutable: true,
    },
    snapshotHash: { type: String, required: true, match: /^[a-f0-9]{64}$/, immutable: true },
    answers: { type: [StoredAnswerSchema], required: true, default: [] },
    currentQuestionIndex: { type: Number, required: true, default: 0, min: 0 },
    highestBatch: { type: Number, required: true, default: 0, min: 0 },
    sessionCode: { type: String, required: true, trim: true, minlength: 8, maxlength: 32 },
    idleExpiresAt: { type: Date, required: true },
    absoluteExpiresAt: { type: Date, required: true },
    purgeAt: { type: Date, required: true },
    batchWindowStartedAt: { type: Date, required: true },
    batchRequestCount: { type: Number, required: true, default: 0, min: 0 },
    submissionIdempotencyKey: {
      type: String,
      minlength: 16,
      maxlength: 128,
    },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

PremiumPlaySessionSchema.index({ user: 1, quiz: 1, createdAt: -1 });
PremiumPlaySessionSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

const PremiumPlaySessionModel =
  (mongoose.models['PremiumPlaySession'] as
    | mongoose.Model<PremiumPlaySessionDocument>
    | undefined) ??
  mongoose.model<PremiumPlaySessionDocument>('PremiumPlaySession', PremiumPlaySessionSchema);

export default PremiumPlaySessionModel;
