import { describe, expect, it } from 'vitest';

import { calculateLevel, levelProgress, xpForNextLevel } from './gamification';

describe('gamification', () => {
  it('calculates level from xp boundaries', () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(99)).toBe(1);
    expect(calculateLevel(100)).toBe(2);
    expect(calculateLevel(250)).toBe(3);
  });

  it('calculates xp needed to next level', () => {
    expect(xpForNextLevel(0)).toBe(100);
    expect(xpForNextLevel(99)).toBe(1);
    expect(xpForNextLevel(100)).toBe(100);
    expect(xpForNextLevel(250)).toBe(50);
  });

  it('calculates in-level progress as percentage points', () => {
    expect(levelProgress(0)).toBe(0);
    expect(levelProgress(42)).toBe(42);
    expect(levelProgress(199)).toBe(99);
  });
});
