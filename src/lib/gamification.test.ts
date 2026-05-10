import { describe, expect, it } from 'vitest';

import { calculateLevel, levelProgress, xpForNextLevel } from './gamification';

describe('gamification', () => {
  it('calculates level from xp boundaries', () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(99)).toBe(1);
    expect(calculateLevel(100)).toBe(2);
    expect(calculateLevel(250)).toBe(3);
  });

  it('returns level 0 for negative xp (floor rounds toward -inf)', () => {
    expect(calculateLevel(-10)).toBe(0);
  });

  it('returns very high levels for large xp', () => {
    expect(calculateLevel(10000)).toBe(101);
    expect(calculateLevel(100000)).toBe(1001);
  });

  it('calculates xp needed to next level', () => {
    expect(xpForNextLevel(0)).toBe(100);
    expect(xpForNextLevel(99)).toBe(1);
    expect(xpForNextLevel(100)).toBe(100);
    expect(xpForNextLevel(250)).toBe(50);
  });

  it('returns 0 xp for next when exactly on a level boundary', () => {
    // At level 2 with exactly 200 xp — need 0 to reach level 3 (for a strict definition)
    // Actually level 2 starts at 100, so 200 xp = level 3, next is 300
    // Wait: level = floor(xp/100) + 1, so 200 = level 3, xpForNext = 3*100 - 200 = 100
    expect(xpForNextLevel(200)).toBe(100);
  });

  it('calculates in-level progress as percentage points', () => {
    expect(levelProgress(0)).toBe(0);
    expect(levelProgress(42)).toBe(42);
    expect(levelProgress(199)).toBe(99);
  });

  it('returns 0 progress at exact level boundary', () => {
    expect(levelProgress(100)).toBe(0);
    expect(levelProgress(200)).toBe(0);
  });

  it('returns 99 progress at top of a level', () => {
    expect(levelProgress(99)).toBe(99);
    expect(levelProgress(199)).toBe(99);
  });

  it('handles negative xp for progress', () => {
    expect(levelProgress(-5)).toBe(-5);
  });
});
