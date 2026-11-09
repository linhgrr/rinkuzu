// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  GUEST_CLAIMS_STORAGE_KEY,
  addGuestClaim,
  clearGuestClaims,
  createGuestClaimToken,
  findGuestClaimToken,
  readGuestClaims,
} from '@/features/quiz/lib/guest-claims';

const NOW = Date.UTC(2026, 10, 5, 12, 0, 0);
const HOUR = 60 * 60 * 1000;

function claim(attemptId: string, takenAt: number = NOW) {
  return { attemptId, token: `token-${attemptId}`, quizSlug: 'fake-quiz', takenAt };
}

describe('guest claims (RIN-912)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('creates a 43-char base64url token without padding, different each time', () => {
    const token = createGuestClaimToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createGuestClaimToken()).not.toBe(token);
  });

  it('stores a claim and finds its token by attempt id', () => {
    addGuestClaim(claim('attempt-1'), NOW);

    expect(findGuestClaimToken('attempt-1', NOW)).toBe('token-attempt-1');
    expect(findGuestClaimToken('attempt-2', NOW)).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(GUEST_CLAIMS_STORAGE_KEY) ?? '[]')).toEqual([
      claim('attempt-1'),
    ]);
  });

  it('drops claims older than 24 h', () => {
    addGuestClaim(claim('old', NOW - 25 * HOUR), NOW - 25 * HOUR);
    addGuestClaim(claim('recent', NOW - 23 * HOUR), NOW - 23 * HOUR);

    expect(readGuestClaims(NOW).map((entry) => entry.attemptId)).toEqual(['recent']);

    addGuestClaim(claim('new'), NOW);
    expect(
      JSON.parse(window.localStorage.getItem(GUEST_CLAIMS_STORAGE_KEY) ?? '[]').map(
        (entry: { attemptId: string }) => entry.attemptId,
      ),
    ).toEqual(['new', 'recent']);
  });

  it('keeps only the 10 newest claims', () => {
    for (let index = 0; index < 12; index += 1) {
      addGuestClaim(claim(`attempt-${index}`, NOW + index), NOW + index);
    }

    const ids = readGuestClaims(NOW + 12).map((entry) => entry.attemptId);
    expect(ids).toHaveLength(10);
    expect(ids[0]).toBe('attempt-11');
    expect(ids).not.toContain('attempt-0');
    expect(ids).not.toContain('attempt-1');
  });

  it('replaces an existing claim for the same attempt', () => {
    addGuestClaim(claim('attempt-1'), NOW);
    addGuestClaim({ ...claim('attempt-1'), token: 'second' }, NOW);

    expect(readGuestClaims(NOW)).toHaveLength(1);
    expect(findGuestClaimToken('attempt-1', NOW)).toBe('second');
  });

  it.each(['{not json', '{"attemptId":"x"}', '[{"attemptId":1}]'])(
    'treats corrupt storage %s as empty',
    (raw) => {
      window.localStorage.setItem(GUEST_CLAIMS_STORAGE_KEY, raw);

      expect(readGuestClaims(NOW)).toEqual([]);
      addGuestClaim(claim('attempt-1'), NOW);
      expect(readGuestClaims(NOW)).toEqual([claim('attempt-1')]);
    },
  );

  it('marks a pending claim with a value-free cookie and clears it with the claims (RIN-921)', () => {
    addGuestClaim(claim('attempt-1'), NOW);
    expect(document.cookie).toContain('rk_guest_claim_pending=1');
    expect(document.cookie).not.toContain('token-attempt-1');
    expect(document.cookie).not.toContain('attempt-1');

    clearGuestClaims();

    expect(window.localStorage.getItem(GUEST_CLAIMS_STORAGE_KEY)).toBeNull();
    expect(readGuestClaims(NOW)).toEqual([]);
    expect(document.cookie).not.toContain('rk_guest_claim_pending');
  });
  it('keeps only well-formed entries from storage', () => {
    window.localStorage.setItem(
      GUEST_CLAIMS_STORAGE_KEY,
      JSON.stringify([
        claim('attempt-ok'),
        null,
        'attempt-string',
        ['attempt-array'],
        { ...claim('attempt-number-id'), attemptId: 7 },
        { ...claim('attempt-no-token'), token: undefined },
        { ...claim('attempt-slug-null'), quizSlug: null },
        { ...claim('attempt-string-time'), takenAt: String(NOW) },
      ]),
    );

    expect(readGuestClaims(NOW).map((entry) => entry.attemptId)).toEqual(['attempt-ok']);
  });

  it('keeps zod out of the app-layout client graph (RIN-1370)', () => {
    const source = readFileSync(path.join(__dirname, 'guest-claims.ts'), 'utf8');

    expect(source).not.toMatch(/from 'zod/);
  });
});
