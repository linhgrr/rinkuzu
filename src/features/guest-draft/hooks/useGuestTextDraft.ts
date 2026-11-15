'use client';

import {
  classifyGuestTextDraftError,
  createGuestTextDraft,
} from '@/features/guest-draft/api/guest-draft-api';
import { useGuestDraftRun } from '@/features/guest-draft/hooks/useGuestDraftRun';
import { guestDraftEntryFromSearch } from '@/features/guest-draft/lib/resolve-guest-entry';
import { ROUTES } from '@/shared/constants/routes';

/**
 * The guest pasted-text flow (RIN-1539): the same state machine, polling, claim and player
 * handoff as `/try/pdf`, without a file. The text stays in the page's own state: it is sent
 * to the create route once and never stored, put in a URL or sent to analytics. The entry is
 * the page's known `?entry=`, else `try_text`, read at submit time (RIN-1645).
 */
export function useGuestTextDraft() {
  const { state, dispatch, start, cancel, playNow } = useGuestDraftRun(ROUTES.TRY_TEXT_PLAY);

  const submit = (text: string) =>
    start(
      (token, locale) =>
        createGuestTextDraft({
          text,
          token,
          locale,
          entry: guestDraftEntryFromSearch(window.location.search) ?? 'try_text',
        }),
      (error) => classifyGuestTextDraftError(error, text),
    );

  return { state, submit, edit: () => dispatch({ type: 'removed' }), cancel, playNow };
}
