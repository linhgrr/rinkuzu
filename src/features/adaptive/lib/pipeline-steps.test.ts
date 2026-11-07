import { describe, expect, it } from 'vitest';
import { stepFromProgress } from './pipeline-steps';

describe('stepFromProgress', () => {
  it.each([
    [0, null],
    [0.05, 1],
    [0.3, 2],
    [0.35, 3],
    [0.65, 4],
    [0.8, 5],
    [0.95, 6],
  ])('maps progress %s to step %s', (progress, step) => {
    expect(stepFromProgress(progress)).toBe(step);
  });
});
