'use client';

import {
  classifyGuestImageDraftError,
  createGuestImageDraft,
} from '@/features/guest-draft/api/guest-draft-api';
import { useGuestDraftRun } from '@/features/guest-draft/hooks/useGuestDraftRun';
import { guestDraftEntryFromSearch } from '@/features/guest-draft/lib/resolve-guest-entry';
import { ROUTES } from '@/shared/constants/routes';

/**
 * The guest photo flow (RIN-1793): the same state machine, polling, claim and player
 * handoff as `/try/text`, with prepared JPEGs (RIN-1790) instead of text. The photos stay in
 * the page's own state, are sent to the create route once (the API reads the text before
 * any draft exists) and are never stored, put in a URL or sent to analytics. The entry is
 * the page's known `?entry=`, else `try_photo`, read at submit time (RIN-1645).
 */
export function useGuestImageDraft() {
  const { state, dispatch, start, cancel, playNow } = useGuestDraftRun(ROUTES.TRY_PHOTO_PLAY);

  const submit = (images: readonly Blob[]) =>
    start(
      (token, locale) =>
        createGuestImageDraft({
          images,
          token,
          locale,
          entry: guestDraftEntryFromSearch(window.location.search) ?? 'try_photo',
        }),
      classifyGuestImageDraftError,
    );

  return { state, submit, edit: () => dispatch({ type: 'removed' }), cancel, playNow };
}
