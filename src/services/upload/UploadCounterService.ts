import type { IUploadCounterRepository } from '@/interfaces/repositories/IUploadCounterRepository';
import { logger } from '@/lib/logger';
import {
  normalizeUploadExt,
  type UploadRejectionReason,
  type UploadSizeBucket,
  type UploadSurface,
} from '@/shared/constants/upload-counters';

export interface UploadRejectionInput {
  ext: string;
  reason: UploadRejectionReason;
  surface: UploadSurface;
  sizeBucket: UploadSizeBucket;
}

/** UTC day, `YYYY-MM-DD`. */
function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Daily upload counters (RIN-1785): which file types learners drop on the
 * upload surfaces and we refuse, and how many office files became drafts.
 * Counting never fails the caller: an error is logged by class and dropped.
 */
export class UploadCounterService {
  constructor(
    private readonly counters: IUploadCounterRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async recordRejection(input: UploadRejectionInput): Promise<void> {
    await this.safely(() =>
      this.counters.increment({
        day: utcDay(this.now()),
        kind: 'file_rejected',
        surface: input.surface,
        ext: normalizeUploadExt(input.ext),
        reason: input.reason,
        sizeBucket: input.sizeBucket,
      }),
    );
  }

  /** A text draft made from an office file (`source_file_type` set), by surface and extension. */
  async recordOfficeDraft(surface: UploadSurface, ext: string): Promise<void> {
    await this.safely(() =>
      this.counters.increment({
        day: utcDay(this.now()),
        kind: 'office_draft_created',
        surface,
        ext: normalizeUploadExt(ext),
        reason: '',
        sizeBucket: '',
      }),
    );
  }

  private async safely(write: () => Promise<void>): Promise<void> {
    try {
      await write();
    } catch (error) {
      logger.warn(
        { errorName: error instanceof Error ? error.name : 'unknown' },
        'Upload counter write failed',
      );
    }
  }
}
