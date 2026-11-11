'use client';

import { useEffect, useReducer } from 'react';
import { useLocale } from 'next-intl';
import { fetchGuestDraftProgress } from '@/features/guest-draft/api/guest-draft-api';
import {
  guestUploadReducer,
  initialGuestUploadState,
} from '@/features/guest-draft/lib/guest-upload-state';
import type {
  GuestDraftProgress,
  GuestDraftRefusal,
} from '@/features/guest-draft/types/guest-draft-view-model';
import { createGuestClaimToken } from '@/features/quiz/lib/guest-claims';
import { addGuestDraftClaim } from '@/features/quiz/lib/guest-draft-claims';
import { matchesMedia } from '@/hooks/useMediaQuery';
import { useRouter } from '@/i18n/navigation';

/** How often the page asks for progress while the draft is processing. */
const GUEST_DRAFT_POLL_MS = 2_000;
/** Pause on the "Quiz ready" card before opening the player. */
const READY_REDIRECT_MS = 800;

/** Sends the draft source with a fresh claim token; resolves to its first progress. */
type CreateGuestDraft = (token: string, locale: 'vi' | 'en') => Promise<GuestDraftProgress>;

/**
 * The part of a guest draft run that does not care where the draft came from (RIN-1539):
 * the state machine, the create call with its claim token, progress polling, the handoff
 * to the player once ready, and the leave-page guard while the draft is on its way.
 * Shared by `/try/pdf` and `/try/text`. The token is stored through the claims module so
 * signing up later claims the draft; it never goes into a URL or an analytics event.
 */
export function useGuestDraftRun(playRoute: string) {
  const [state, dispatch] = useReducer(guestUploadReducer, initialGuestUploadState);
  const locale = useLocale() === 'en' ? 'en' : 'vi';
  const router = useRouter();
  const { phase, token, run, polls } = state;
  const waiting = phase === 'uploading' || phase === 'processing';

  const start = async (
    create: CreateGuestDraft,
    classify: (error: unknown) => GuestDraftRefusal,
  ) => {
    if (waiting) return;
    const draftToken = createGuestClaimToken();
    const nextRun = run + 1;
    dispatch({ type: 'upload_started', token: draftToken, now: Date.now() });
    try {
      const progress = await create(draftToken, locale);
      addGuestDraftClaim({ token: draftToken, createdAt: Date.now() });
      dispatch({ type: 'progressed', run: nextRun, progress, now: Date.now() });
    } catch (error) {
      dispatch({ type: 'upload_refused', run: nextRun, refusal: classify(error) });
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
    const timer = window.setTimeout(() => router.push(playRoute), delay);
    return () => window.clearTimeout(timer);
  }, [phase, router, playRoute]);

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
    dispatch,
    start,
    cancel: () => dispatch({ type: 'cancelled' }),
    playNow: () => router.push(playRoute),
  };
}
