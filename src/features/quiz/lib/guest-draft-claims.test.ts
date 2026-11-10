// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  CLAIMED_GUEST_DRAFT_STORAGE_KEY,
  GUEST_DRAFTS_STORAGE_KEY,
  addGuestDraftClaim,
  clearGuestDraftClaims,
  readClaimedGuestDraftQuiz,
  readGuestDraftClaims,
  rememberClaimedGuestDraftQuiz,
} from '@/features/quiz/lib/guest-draft-claims';
import { GUEST_CLAIM_PENDING_COOKIE } from '@/shared/constants/starter-quiz';

const NOW = Date.UTC(2026, 10, 10, 12, 0, 0);
const HOUR = 60 * 60 * 1000;

describe('guest draft claims (RIN-1447)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = `${GUEST_CLAIM_PENDING_COOKIE}=; Max-Age=0; Path=/`;
  });

  it('stores tokens newest first, without duplicates, and marks a claim pending', () => {
    addGuestDraftClaim({ token: 'token-a', createdAt: NOW - HOUR }, NOW);
    addGuestDraftClaim({ token: 'token-b', createdAt: NOW }, NOW);
    addGuestDraftClaim({ token: 'token-a', createdAt: NOW }, NOW);

    expect(readGuestDraftClaims(NOW).map((claim) => claim.token)).toEqual(['token-a', 'token-b']);
    expect(document.cookie).toContain(`${GUEST_CLAIM_PENDING_COOKIE}=1`);
  });

  it('drops entries older than 24 hours and keeps at most 5', () => {
    addGuestDraftClaim({ token: 'old', createdAt: NOW - 25 * HOUR }, NOW - 25 * HOUR);
    for (let index = 0; index < 6; index += 1) {
      addGuestDraftClaim({ token: `token-${index}`, createdAt: NOW }, NOW);
    }

    const tokens = readGuestDraftClaims(NOW).map((claim) => claim.token);
    expect(tokens).toHaveLength(5);
    expect(tokens).not.toContain('old');
    expect(tokens[0]).toBe('token-5');
  });

  it('treats unreadable or malformed storage as no drafts', () => {
    window.localStorage.setItem(GUEST_DRAFTS_STORAGE_KEY, '{not json');
    expect(readGuestDraftClaims(NOW)).toEqual([]);

    window.localStorage.setItem(
      GUEST_DRAFTS_STORAGE_KEY,
      JSON.stringify([{ token: 1, createdAt: NOW }, { token: 'ok', createdAt: NOW }, null]),
    );
    expect(readGuestDraftClaims(NOW)).toEqual([{ token: 'ok', createdAt: NOW }]);
  });

  it('forgets every token on clear', () => {
    addGuestDraftClaim({ token: 'token-a', createdAt: NOW }, NOW);
    clearGuestDraftClaims();
    expect(window.localStorage.getItem(GUEST_DRAFTS_STORAGE_KEY)).toBeNull();
  });

  it('remembers the quiz a claim made for 24 hours (RIN-1485)', () => {
    expect(readClaimedGuestDraftQuiz(NOW)).toBeNull();
    rememberClaimedGuestDraftQuiz('fake-claimed-quiz', NOW);

    expect(readClaimedGuestDraftQuiz(NOW + HOUR)).toBe('fake-claimed-quiz');
    expect(readClaimedGuestDraftQuiz(NOW + 25 * HOUR)).toBeNull();
  });

  it('treats an unreadable claimed quiz entry as none (RIN-1485)', () => {
    window.localStorage.setItem(CLAIMED_GUEST_DRAFT_STORAGE_KEY, '{not json');
    expect(readClaimedGuestDraftQuiz(NOW)).toBeNull();
    window.localStorage.setItem(
      CLAIMED_GUEST_DRAFT_STORAGE_KEY,
      JSON.stringify({ slug: 7, claimedAt: NOW }),
    );
    expect(readClaimedGuestDraftQuiz(NOW)).toBeNull();
  });
});
