'use client';

import {
  classifyGuestDraftError,
  createGuestDraft,
} from '@/features/guest-draft/api/guest-draft-api';
import { useGuestDraftRun } from '@/features/guest-draft/hooks/useGuestDraftRun';
import { checkGuestPdf, type GuestPdfCheck } from '@/features/guest-draft/lib/check-guest-pdf';
import {
  guestDraftEntryFromSearch,
  resolveGuestDraftEntry,
} from '@/features/guest-draft/lib/resolve-guest-entry';
import { reportUploadRejection } from '@/lib/upload-rejection-client';
import { ROUTES } from '@/shared/constants/routes';
import type { UploadRejectionReason } from '@/shared/constants/upload-counters';

/** Browser-check refusals as counted reasons (RIN-1785). */
const GUEST_CHECK_REASON: Record<Exclude<GuestPdfCheck, 'ok'>, UploadRejectionReason> = {
  not_pdf: 'wrong_type',
  too_large: 'too_large',
};

/**
 * The guest upload flow (RIN-1448): browser checks, then the shared guest draft run
 * (upload, progress polling and the handoff to the guest player). The entry is the page's
 * known `?entry=`, else the referrer's, read at upload time (RIN-1645).
 */
export function useGuestPdfDraft() {
  const { state, dispatch, start, cancel, playNow } = useGuestDraftRun(ROUTES.TRY_PDF_PLAY);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    dispatch({ type: 'check_started', file });
    const result = await checkGuestPdf(file);
    if (result !== 'ok') {
      reportUploadRejection({ file, reason: GUEST_CHECK_REASON[result], surface: 'try_pdf' });
    }
    dispatch({ type: 'check_finished', file, result });
  };

  const submit = async () => {
    const file = state.file;
    if (!file) return;
    await start(
      (token, locale) =>
        createGuestDraft({
          file,
          token,
          locale,
          entry: resolveGuestDraftEntry(
            guestDraftEntryFromSearch(window.location.search),
            document.referrer,
          ),
        }),
      classifyGuestDraftError,
    );
  };

  return {
    state,
    choose,
    submit,
    remove: () => dispatch({ type: 'removed' }),
    cancel,
    playNow,
  };
}
