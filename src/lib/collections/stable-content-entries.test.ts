import { describe, expect, it } from 'vitest';
import { toStableContentEntries } from './stable-content-entries';

describe('toStableContentEntries', () => {
  it('keeps unique content keys stable when the list reorders', () => {
    const before = toStableContentEntries(['alpha', 'beta']);
    const after = toStableContentEntries(['beta', 'alpha']);

    expect(before.find(({ content }) => content === 'alpha')?.key).toBe(
      after.find(({ content }) => content === 'alpha')?.key,
    );
  });

  it('gives duplicate content deterministic unique keys', () => {
    const entries = toStableContentEntries(['same', 'same']);

    expect(new Set(entries.map(({ key }) => key))).toHaveProperty('size', 2);
    expect(entries.map(({ sourceIndex }) => sourceIndex)).toEqual([0, 1]);
  });
});
