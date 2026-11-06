// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { drawQuickRound, markQuickRoundSeen, readQuickRoundSeen } from './quick-round-draw';

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('drawQuickRound', () => {
  it('returns 10 unique in-range indices', () => {
    const drawn = drawQuickRound(40, [], seededRandom(1));
    expect(drawn).toHaveLength(10);
    expect(new Set(drawn).size).toBe(10);
    expect(drawn.every((index) => index >= 0 && index < 40)).toBe(true);
  });

  it('prefers questions not yet seen', () => {
    const seen = Array.from({ length: 20 }, (_, index) => index);
    const drawn = drawQuickRound(30, seen, seededRandom(7));
    expect([...drawn].sort((a, b) => a - b)).toEqual([20, 21, 22, 23, 24, 25, 26, 27, 28, 29]);
  });

  it('fills from seen questions when fewer than 10 are unseen', () => {
    const seen = Array.from({ length: 13 }, (_, index) => index);
    const drawn = drawQuickRound(16, seen, seededRandom(3));
    expect(drawn).toHaveLength(10);
    expect(new Set(drawn).size).toBe(10);
    expect(drawn).toEqual(expect.arrayContaining([13, 14, 15]));
  });

  it('ignores seen indices outside the quiz', () => {
    const drawn = drawQuickRound(16, [99, -1, 2.5], seededRandom(5));
    expect(drawn.every((index) => Number.isInteger(index) && index < 16)).toBe(true);
  });
});

describe('quick-round seen storage', () => {
  afterEach(() => window.sessionStorage.clear());

  it('accumulates indices per quiz in sessionStorage', () => {
    markQuickRoundSeen('quiz-a', [1, 2]);
    markQuickRoundSeen('quiz-a', [2, 3]);
    expect(readQuickRoundSeen('quiz-a')).toEqual([1, 2, 3]);
    expect(readQuickRoundSeen('quiz-b')).toEqual([]);
  });

  it('treats unreadable storage as nothing seen', () => {
    window.sessionStorage.setItem('rinkuzu_quick_seen_v1:quiz-a', '{not json');
    expect(readQuickRoundSeen('quiz-a')).toEqual([]);
  });
});
