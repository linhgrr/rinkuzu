import type {
  UploadCounterKind,
  UploadSizeBucket,
  UploadSurface,
} from '@/shared/constants/upload-counters';

export interface UploadCounterKey {
  /** UTC day, `YYYY-MM-DD`. */
  readonly day: string;
  readonly kind: UploadCounterKind;
  readonly surface: UploadSurface;
  readonly ext: string;
  /** Empty for `office_draft_created`. */
  readonly reason: string;
  /** Empty for `office_draft_created`. */
  readonly sizeBucket: UploadSizeBucket | '';
}

/** One counter row summed over the range asked for. Counts only. */
export interface UploadCounterTotal {
  readonly day: string;
  readonly kind: UploadCounterKind;
  readonly surface: UploadSurface;
  readonly ext: string;
  readonly reason: string;
  readonly count: number;
}

export interface IUploadCounterRepository {
  /** Adds one to the counter of the key, creating it on the first hit. */
  increment(key: UploadCounterKey): Promise<void>;
  /** Counters of the days `[fromDay, toDay]` (inclusive, `YYYY-MM-DD`), summed per day and key. */
  listDaily(fromDay: string, toDay: string): Promise<UploadCounterTotal[]>;
}
