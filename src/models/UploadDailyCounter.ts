import mongoose, { Schema } from 'mongoose';

import type {
  UploadCounterKind,
  UploadSizeBucket,
  UploadSurface,
} from '@/shared/constants/upload-counters';

/**
 * Daily upload counters (RIN-1785): one document per day and key, `count`
 * incremented with `$inc`. No IP, user id, file name or content is stored, so
 * there is nothing to expire. `reason` and `sizeBucket` are empty strings for
 * `office_draft_created` rows.
 */
export interface UploadDailyCounterDocument {
  /** UTC day, `YYYY-MM-DD`. */
  day: string;
  kind: UploadCounterKind;
  surface: UploadSurface;
  ext: string;
  reason: string;
  sizeBucket: UploadSizeBucket | '';
  count: number;
}

const UploadDailyCounterSchema = new Schema<UploadDailyCounterDocument>(
  {
    day: { type: String, required: true },
    kind: { type: String, required: true },
    surface: { type: String, required: true },
    ext: { type: String, required: true },
    reason: { type: String, required: true, default: '' },
    sizeBucket: { type: String, required: true, default: '' },
    count: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

UploadDailyCounterSchema.index(
  { day: 1, kind: 1, surface: 1, ext: 1, reason: 1, sizeBucket: 1 },
  { unique: true },
);

export const UploadDailyCounter =
  (mongoose.models['UploadDailyCounter'] as
    mongoose.Model<UploadDailyCounterDocument> | undefined) ??
  mongoose.model<UploadDailyCounterDocument>(
    'UploadDailyCounter',
    UploadDailyCounterSchema,
    'uploaddailycounters',
  );
