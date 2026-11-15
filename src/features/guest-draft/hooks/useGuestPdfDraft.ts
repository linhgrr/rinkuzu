'use client';

import {
  classifyGuestDraftError,
  createGuestDraft,
} from '@/features/guest-draft/api/guest-draft-api';
import { useGuestDraftRun } from '@/features/guest-draft/hooks/useGuestDraftRun';
import { checkGuestPdf } from '@/features/guest-draft/lib/check-guest-pdf';
import {
  guestDraftEntryFromSearch,
  resolveGuestDraftEntry,
} from '@/features/guest-draft/lib/resolve-guest-entry';
import { ROUTES } from '@/shared/constants/routes';

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
    dispatch({ type: 'check_finished', file, result: await checkGuestPdf(file) });
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
