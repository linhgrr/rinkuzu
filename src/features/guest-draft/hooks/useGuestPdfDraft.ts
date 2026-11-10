'use client';

import { useEffect, useReducer } from 'react';
import { useLocale } from 'next-intl';
import {
  classifyGuestDraftError,
  createGuestDraft,
  fetchGuestDraftProgress,
} from '@/features/guest-draft/api/guest-draft-api';
import { checkGuestPdf } from '@/features/guest-draft/lib/check-guest-pdf';
import {
  guestUploadReducer,
  initialGuestUploadState,
} from '@/features/guest-draft/lib/guest-upload-state';
import { createGuestClaimToken } from '@/features/quiz/lib/guest-claims';
import { addGuestDraftClaim } from '@/features/quiz/lib/guest-draft-claims';
import { matchesMedia } from '@/hooks/useMediaQuery';
import { useRouter } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants/routes';
import type { GuestDraftEntry } from '@/shared/constants/guest-draft';

/** How often the page asks for progress while the draft is processing. */
const GUEST_DRAFT_POLL_MS = 2_000;
/** Pause on the "Quiz ready" card before opening the player. */
const READY_REDIRECT_MS = 800;

/**
 * The guest upload flow (RIN-1448): browser checks, upload, progress polling and the
 * handoff to the guest player. The token is stored through the claims module so signing
 * up later claims the draft; it never goes into a URL or an analytics event.
 */
export function useGuestPdfDraft(entry: GuestDraftEntry) {
  const [state, dispatch] = useReducer(guestUploadReducer, initialGuestUploadState);
  const locale = useLocale() === 'en' ? 'en' : 'vi';
  const router = useRouter();
  const { phase, token, run, polls } = state;
  const waiting = phase === 'uploading' || phase === 'processing';

  const choose = async (file: File | undefined) => {
    if (!file) return;
    dispatch({ type: 'check_started', file });
    dispatch({ type: 'check_finished', file, result: await checkGuestPdf(file) });
  };

  const submit = async () => {
    const file = state.file;
    if (!file || waiting) return;
    const draftToken = createGuestClaimToken();
    const nextRun = run + 1;
    dispatch({ type: 'upload_started', token: draftToken, now: Date.now() });
    try {
      const progress = await createGuestDraft({ file, token: draftToken, locale, entry });
      addGuestDraftClaim({ token: draftToken, createdAt: Date.now() });
      dispatch({ type: 'progressed', run: nextRun, progress, now: Date.now() });
    } catch (error) {
      dispatch({ type: 'upload_refused', run: nextRun, refusal: classifyGuestDraftError(error) });
    }
  };

  useEffect(() => {
    if (phase !== 'processing' || !token) return;
    const timer = window.setTimeout(() => {
      fetchGuestDraftProgress(token).then(
        (progress) => dispatch({ type: 'progressed', run, progress, now: Date.now() }),
        () => dispatch({ type: 'poll_failed', run, now: Date.now() }),
      );
    }, GUEST_DRAFT_POLL_MS);
    return () => window.clearTimeout(timer);
    // `polls` changes on every answer, which schedules the next check.
  }, [phase, token, run, polls]);

  useEffect(() => {
    if (phase !== 'ready') return;
    const delay = matchesMedia('(prefers-reduced-motion: reduce)') ? 0 : READY_REDIRECT_MS;
    const timer = window.setTimeout(() => router.push(ROUTES.TRY_PDF_PLAY), delay);
    return () => window.clearTimeout(timer);
  }, [phase, router]);

  useEffect(() => {
    if (!waiting) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [waiting]);

  return {
    state,
    choose,
    submit,
    remove: () => dispatch({ type: 'removed' }),
    cancel: () => dispatch({ type: 'cancelled' }),
    playNow: () => router.push(ROUTES.TRY_PDF_PLAY),
  };
}
