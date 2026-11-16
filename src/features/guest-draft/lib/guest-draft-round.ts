/**
 * The round a guest draft attempt covered (RIN-1620), kept in sessionStorage by attempt id
 * so the result page can offer the questions that arrived after it. Not secret: no token,
 * no answers. Lost with the tab: the result page then shows no "more questions" card.
 */

import { GUEST_DRAFT_SOURCES, type GuestDraftSource } from '@/shared/constants/guest-draft';

export interface GuestDraftRound {
  /** Index of the round's first question in the draft. */
  from: number;
  /** Questions the round showed. */
  count: number;
  /** The draft still had questions coming when the round was submitted. */
  pending: boolean;
  /** Which play page "Keep going" returns to. */
  source: GuestDraftSource;
}

const ROUND_KEY_PREFIX = 'rinkuzu.guestDraftRound.v1.';

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    // Storage disabled (privacy mode, blocked cookies).
    return null;
  }
}

function isRound(value: unknown): value is GuestDraftRound {
  if (typeof value !== 'object' || value === null) return false;
  const round = value as Record<keyof GuestDraftRound, unknown>;
  return (
    Number.isInteger(round.from) &&
    Number.isInteger(round.count) &&
    typeof round.pending === 'boolean' &&
    GUEST_DRAFT_SOURCES.some((source) => source === round.source)
  );
}

export function rememberGuestDraftRound(attemptId: string, round: GuestDraftRound): void {
  try {
    getStorage()?.setItem(ROUND_KEY_PREFIX + attemptId, JSON.stringify(round));
  } catch {
    // Quota or disabled storage: the result page just shows no card.
  }
}

export function readGuestDraftRound(attemptId: string): GuestDraftRound | null {
  const raw = getStorage()?.getItem(ROUND_KEY_PREFIX + attemptId);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRound(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** `?from=` of the "Keep going" play link: a whole number from 1, else the draft's start. */
export function parseRoundStart(search: string): number {
  const raw = new URLSearchParams(search).get('from');
  const from = raw === null ? 0 : Number(raw);
  return Number.isInteger(from) && from > 0 ? from : 0;
}
