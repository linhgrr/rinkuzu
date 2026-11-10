import mongoose, { Schema } from 'mongoose';

import { QuizQuestionSchema, type QuizQuestionDocument } from '@/models/schemas/QuizQuestionSchema';
import {
  GUEST_DRAFT_ENTRIES,
  GUEST_DRAFT_STATUSES,
  type GuestDraftEntry,
  type GuestDraftStatus,
} from '@/shared/constants/guest-draft';

/**
 * A quiz a signed-out visitor generated from their own PDF (RIN-1441). Kept out of the
 * `Quiz` collection on purpose: lists, sitemap, search and admin pages read `Quiz`, and a
 * guest draft must appear in none of them. Only the SHA-256 of the browser's token is
 * stored; the TTL index deletes an unclaimed draft 24 h after it was created.
 */
export interface GuestQuizDraftDocument {
  tokenHash: string;
  apiDraftId: string;
  status: GuestDraftStatus;
  title?: string;
  questions: QuizQuestionDocument[];
  locale: 'vi' | 'en';
  entry: GuestDraftEntry;
  failureReason?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GuestQuizDraftSchema = new Schema<GuestQuizDraftDocument>(
  {
    tokenHash: { type: String, required: true, match: /^[a-f0-9]{64}$/, immutable: true },
    apiDraftId: { type: String, required: true, maxlength: 64, immutable: true },
    status: { type: String, enum: GUEST_DRAFT_STATUSES, required: true },
    title: { type: String, trim: true, maxlength: 200 },
    questions: { type: [QuizQuestionSchema], default: [] },
    locale: { type: String, enum: ['vi', 'en'], required: true },
    entry: { type: String, enum: GUEST_DRAFT_ENTRIES, required: true },
    failureReason: { type: String, maxlength: 64 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

GuestQuizDraftSchema.index({ tokenHash: 1 }, { unique: true });
GuestQuizDraftSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const GuestQuizDraftModel =
  (mongoose.models['GuestQuizDraft'] as mongoose.Model<GuestQuizDraftDocument> | undefined) ??
  mongoose.model<GuestQuizDraftDocument>('GuestQuizDraft', GuestQuizDraftSchema);

export default GuestQuizDraftModel;
