import { describe, expect, it } from 'vitest';

import { calculateLevel, levelProgress, xpForNextLevel } from '../../src/lib/gamification';

describe('integration: gamification flow', () => {
  it('keeps level, progress and next-xp consistent', () => {
    const totalXp = 185;

    const level = calculateLevel(totalXp);
    const progress = levelProgress(totalXp);
    const toNext = xpForNextLevel(totalXp);

    expect(level).toBe(2);
    expect(progress).toBe(85);
    expect(toNext).toBe(15);
    expect(progress + toNext).toBe(100);
  });
});
