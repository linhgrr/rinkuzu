import mongoose, { Schema } from 'mongoose';

/**
 * IndexNow batch state (RIN-1500). `indexnowpendingurls` holds public page
 * URLs waiting for the next ping, with no user or quiz ids; the TTL drops a
 * URL that never got sent, so the collection cannot grow. `indexnowthrottles`
 * holds one document, the time of the last send.
 */
const INDEXNOW_PENDING_TTL_SECONDS = 3 * 24 * 60 * 60;
export const INDEXNOW_THROTTLE_ID = 'global';

interface IndexNowPendingUrlDocument {
  url: string;
  queuedAt: Date;
}

interface IndexNowThrottleDocument {
  _id: string;
  lastSentAt: Date;
}

const IndexNowPendingUrlSchema = new Schema<IndexNowPendingUrlDocument>(
  {
    url: { type: String, required: true },
    queuedAt: { type: Date, required: true },
  },
  { versionKey: false },
);

IndexNowPendingUrlSchema.index({ url: 1 }, { unique: true });
IndexNowPendingUrlSchema.index(
  { queuedAt: 1 },
  { expireAfterSeconds: INDEXNOW_PENDING_TTL_SECONDS },
);

const IndexNowThrottleSchema = new Schema<IndexNowThrottleDocument>(
  {
    _id: { type: String, required: true },
    lastSentAt: { type: Date, required: true },
  },
  { versionKey: false },
);

export const IndexNowPendingUrl =
  (mongoose.models['IndexNowPendingUrl'] as
    | mongoose.Model<IndexNowPendingUrlDocument>
    | undefined) ??
  mongoose.model<IndexNowPendingUrlDocument>(
    'IndexNowPendingUrl',
    IndexNowPendingUrlSchema,
    'indexnowpendingurls',
  );

export const IndexNowThrottle =
  (mongoose.models['IndexNowThrottle'] as mongoose.Model<IndexNowThrottleDocument> | undefined) ??
  mongoose.model<IndexNowThrottleDocument>(
    'IndexNowThrottle',
    IndexNowThrottleSchema,
    'indexnowthrottles',
  );
