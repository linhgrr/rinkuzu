import { describe, expect, it } from 'vitest';
import {
  buildInitialMatchingAnswer,
  getMatchingInteractionItems,
} from '@/features/adaptive/lib/matching-answer';
import type { Exercise } from '@/features/adaptive/types/learning';

const matchingExercise: Pick<Exercise, 'pairs' | 'right_items'> = {
  pairs: [
    { left: 'A', right: '1' },
    { left: 'B', right: '2' },
  ],
  right_items: ['2', '1'],
};

describe('matching-answer', () => {
  it('builds the initial answer from shuffled backend right_items', () => {
    expect(buildInitialMatchingAnswer(matchingExercise)).toEqual({
      A: '2',
      B: '1',
    });
  });

  it('uses pair right values when backend omits right_items', () => {
    expect(buildInitialMatchingAnswer({ ...matchingExercise, right_items: [] })).toEqual({
      A: '1',
      B: '2',
    });
  });

  it('throws when backend sends partial right_items', () => {
    expect(() => buildInitialMatchingAnswer({ ...matchingExercise, right_items: ['1'] })).toThrow(
      'Matching exercise has 2 pair(s) but 1 right item(s)',
    );
  });

  it('throws when left items are duplicated', () => {
    expect(() =>
      buildInitialMatchingAnswer({
        pairs: [
          { left: 'A', right: '1' },
          { left: 'A', right: '2' },
        ],
        right_items: [],
      }),
    ).toThrow('Matching exercise contains duplicate left item: A');
  });

  it('uses the current answer draft order for interaction rendering', () => {
    expect(
      getMatchingInteractionItems(matchingExercise, {
        B: '1',
        A: '2',
      }),
    ).toEqual({
      leftItems: ['B', 'A'],
      rightItems: ['1', '2'],
    });
  });

  it('builds interaction rendering items from the initial answer when draft is empty', () => {
    expect(getMatchingInteractionItems(matchingExercise, {})).toEqual({
      leftItems: ['A', 'B'],
      rightItems: ['2', '1'],
    });
  });

  it('throws when a sparse right_items list claims matching length but misses an index', () => {
    const sparseRightItems = ['only-first'] as string[];
    sparseRightItems.length = 2;

    expect(() =>
      buildInitialMatchingAnswer({
        pairs: [
          { left: 'A', right: '1' },
          { left: 'B', right: '2' },
        ],
        right_items: sparseRightItems,
      }),
    ).toThrow('Matching exercise is missing right item at index 1');
  });

  it('throws when a draft omits a left item required by the current matching map', () => {
    const draft = { A: '1' } as Record<string, string>;
    Object.defineProperty(draft, 'B', { enumerable: true, value: undefined });

    expect(() => getMatchingInteractionItems(matchingExercise, draft)).toThrow(
      'Matching answer is missing value for left item: B',
    );
  });
});
