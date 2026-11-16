import { classifyGuestTextDraftError } from '@/features/guest-draft/api/guest-draft-api';
import type { GuestDraftRefusal } from '@/features/guest-draft/types/guest-draft-view-model';
import type { OfficeRejectReason } from '@/lib/office-text/types';

/** A Word or PowerPoint file the browser could not turn into text (RIN-1786). */
export class GuestOfficeRefusal extends Error {
  constructor(readonly reason: OfficeRejectReason) {
    super(reason);
    this.name = 'GuestOfficeRefusal';
  }
}

const OFFICE_REFUSALS: Record<OfficeRejectReason, GuestDraftRefusal> = {
  too_large: 'office_too_large',
  legacy_format: 'legacy_format',
  encrypted: 'encrypted',
  corrupt: 'corrupt',
  too_little_text: 'too_little_text',
  wrong_type: 'not_pdf',
};

/**
 * Why a Word or PowerPoint draft was refused: the extractor's own reason, else what the
 * text route said (cap, text over the limit, a network error). The extracted text stays in
 * the create call, so a text refusal is classified without it.
 */
export function classifyGuestOfficeError(error: unknown): GuestDraftRefusal {
  if (error instanceof GuestOfficeRefusal) return OFFICE_REFUSALS[error.reason];
  return classifyGuestTextDraftError(error, '');
}
