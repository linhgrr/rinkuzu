'use client';

import { useEffect, useState } from 'react';
import {
  fetchGuestDraftProgress,
  isGuestDraftGone,
} from '@/features/guest-draft/api/guest-draft-api';
import {
  readGuestDraftRound,
  type GuestDraftRound,
} from '@/features/guest-draft/lib/guest-draft-round';
import type { GuestDraftProgress } from '@/features/guest-draft/types/guest-draft-view-model';
import { readGuestDraftClaims } from '@/features/quiz/lib/guest-draft-claims';

/** What the results card says about the rest of a first-batch round (RIN-1620). */
export type GuestDraftMore =
  | { kind: 'pending' }
  | { kind: 'arrived'; count: number }
  | { kind: 'failed' };

/** Same cadence as the player's and the upload page's polling. */
const MORE_POLL_MS = 2_000;
/** About ten minutes: after that the rest is treated as not coming (spec state 5). */
const MORE_MAX_POLLS = 300;

/**
 * The card for one status answer: null when the draft needs no card (the round already
 * covers every stored question of a finished draft).
 */
function moreFor(
  progress: GuestDraftProgress,
  round: GuestDraftRound,
): GuestDraftMore | null {
  if (progress.status === 'failed') return { kind: 'failed' };
  const finished = progress.status === 'ready' && progress.complete !== false;
  if (!finished) return { kind: 'pending' };
  const extra = progress.questionCount - (round.from + round.count);
  if (extra > 0) return { kind: 'arrived', count: extra };
  return progress.completion === 'first_batch_only' ? { kind: 'failed' } : null;
}

/**
 * Follows the draft after a first-batch round until its rest is stored or has failed.
 * Null `round`: the attempt was not a first-batch round (or is another tab's): no card.
 * Null `more`: nothing to offer, for example the draft is gone (a 404: claimed or expired).
 */
export function useGuestDraftMore(attemptId: string | null) {
  const [round] = useState(() => (attemptId ? readGuestDraftRound(attemptId) : null));
  const [more, setMore] = useState<GuestDraftMore | null>(() =>
    round?.pending && readGuestDraftClaims()[0] ? { kind: 'pending' } : null,
  );

  useEffect(() => {
    const token = readGuestDraftClaims()[0]?.token;
    if (!round?.pending || !token) return;
    let cancelled = false;
    let timer: number | undefined;
    // `next` undefined: the look failed, which is not a failed draft, so look again.
    const settle = (polls: number, next: GuestDraftMore | null | undefined) => {
      if (cancelled) return;
      if (next !== undefined) setMore(next);
      if (next !== undefined && next?.kind !== 'pending') return;
      if (polls + 1 >= MORE_MAX_POLLS) {
        setMore({ kind: 'failed' });
        return;
      }
      timer = window.setTimeout(() => look(polls + 1), MORE_POLL_MS);
    };
    const look = (polls: number) => {
      fetchGuestDraftProgress(token).then(
        (progress) => settle(polls, moreFor(progress, round)),
        (error: unknown) => settle(polls, isGuestDraftGone(error) ? null : undefined),
      );
    };
    look(0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [round]);

  return { round, more };
}
