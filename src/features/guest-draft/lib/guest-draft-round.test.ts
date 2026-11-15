/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest';
import { parseRoundStart, readGuestDraftRound, rememberGuestDraftRound } from './guest-draft-round';

describe('guest draft round (RIN-1620)', () => {
  beforeEach(() => sessionStorage.clear());

  it('reads back what it remembered, per attempt', () => {
    const round = { from: 5, count: 5, pending: false, source: 'text' } as const;
    rememberGuestDraftRound('a-1', round);
    expect(readGuestDraftRound('a-1')).toEqual(round);
    expect(readGuestDraftRound('a-2')).toBeNull();
  });

  it('ignores a damaged or foreign entry', () => {
    sessionStorage.setItem('rinkuzu.guestDraftRound.v1.bad', '{not json');
    sessionStorage.setItem(
      'rinkuzu.guestDraftRound.v1.odd',
      JSON.stringify({ from: 'x', count: 5, pending: true, source: 'pdf' }),
    );
    sessionStorage.setItem(
      'rinkuzu.guestDraftRound.v1.src',
      JSON.stringify({ from: 0, count: 5, pending: true, source: 'other' }),
    );
    expect(readGuestDraftRound('bad')).toBeNull();
    expect(readGuestDraftRound('odd')).toBeNull();
    expect(readGuestDraftRound('src')).toBeNull();
  });

  it.each([
    ['?from=5', 5],
    ['', 0],
    ['?from=0', 0],
    ['?from=-3', 0],
    ['?from=2.5', 0],
    ['?from=abc', 0],
  ])('reads the Keep going start of %j as %i', (search, expected) => {
    expect(parseRoundStart(search)).toBe(expected);
  });
});
