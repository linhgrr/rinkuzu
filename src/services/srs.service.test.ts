import { describe, expect, it } from 'vitest';
import { calculateNextReview } from './srs.service';

describe('calculateNextReview (SM-2)', () => {
  it('schedules the first review for 1 day later on "good"', () => {
    const result = calculateNextReview(0, 2.5, 'good');

    expect(result.interval).toBe(1);
    expect(result.srsLevel).toBe(1);
    expect(result.nextReviewDate).toBeInstanceOf(Date);
  });

  it('schedules day 6 after the second consecutive "good"', () => {
    const result = calculateNextReview(1, 2.5, 'good');

    expect(result.interval).toBe(6);
    expect(result.srsLevel).toBe(2);
  });

  it('multiplies interval by ease factor on third+ "good"', () => {
    const result = calculateNextReview(6, 2.5, 'good');

    expect(result.interval).toBe(15); // Math.round(6 * 2.5)
    expect(result.srsLevel).toBe(4); // < 30 days but >= 14
  });

  it('resets to 1 day on "fail" regardless of previous interval', () => {
    const result = calculateNextReview(15, 2.5, 'fail');

    expect(result.interval).toBe(1);
    expect(result.srsLevel).toBe(1);
  });

  it('keeps ease factor >= 1.3 after many increases', () => {
    // Simulate many "hard" reviews (quality = 3) which lowers EF
    let interval = 0;
    let easeFactor = 2.5;

    for (let i = 0; i < 50; i++) {
      const result = calculateNextReview(interval, easeFactor, 'hard');
      interval = result.interval;
      easeFactor = result.easeFactor;
    }

    expect(easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('returns level 5 for intervals >= 30 days', () => {
    // interval 30 * easeFactor 2.5 = 75
    const result = calculateNextReview(30, 2.5, 'good');

    expect(result.interval).toBe(75);
    expect(result.srsLevel).toBe(5);
  });

  it('returns different ease factor deltas for each rating', () => {
    const goodResult = calculateNextReview(1, 2.5, 'good');
    const easyResult = calculateNextReview(1, 2.5, 'easy');
    const hardResult = calculateNextReview(1, 2.5, 'hard');

    // easy increases EF the most, good slightly, hard decreases it
    expect(easyResult.easeFactor).toBeGreaterThan(goodResult.easeFactor);
    expect(goodResult.easeFactor).toBeGreaterThan(hardResult.easeFactor);
  });

  it('sets nextReviewDate to 4 AM of the due day', () => {
    const result = calculateNextReview(0, 2.5, 'good');

    expect(result.nextReviewDate.getHours()).toBe(4);
    expect(result.nextReviewDate.getMinutes()).toBe(0);
    expect(result.nextReviewDate.getSeconds()).toBe(0);
  });

  it('uses 1-day interval on "hard" and "fail" for first review', () => {
    const hard = calculateNextReview(0, 2.5, 'hard');
    const fail = calculateNextReview(0, 2.5, 'fail');

    expect(hard.interval).toBe(1);
    expect(fail.interval).toBe(1);
  });
});
