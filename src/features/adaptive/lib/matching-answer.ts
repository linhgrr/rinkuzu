import type { Exercise } from '@/features/adaptive/types/learning';

type MatchingExercise = Pick<Exercise, 'pairs' | 'right_items'>;

export interface MatchingInteractionItems {
  leftItems: string[];
  rightItems: string[];
}

function getRightItems(exercise: MatchingExercise): string[] {
  if (exercise.right_items.length === 0) {
    return exercise.pairs.map((pair) => pair.right);
  }

  if (exercise.right_items.length !== exercise.pairs.length) {
    throw new TypeError(
      `Matching exercise has ${exercise.pairs.length} pair(s) but ${exercise.right_items.length} right item(s)`,
    );
  }

  return exercise.right_items;
}

export function buildInitialMatchingAnswer(exercise: MatchingExercise): Record<string, string> {
  const rightItems = getRightItems(exercise);
  const matching: Record<string, string> = {};

  exercise.pairs.forEach((pair, index) => {
    if (Object.hasOwn(matching, pair.left)) {
      throw new TypeError(`Matching exercise contains duplicate left item: ${pair.left}`);
    }
    const rightItem = rightItems[index];
    if (rightItem === undefined) {
      throw new TypeError(`Matching exercise is missing right item at index ${index}`);
    }
    matching[pair.left] = rightItem;
  });

  return matching;
}

function getMatchingValue(matching: Record<string, string>, left: string): string {
  const value = matching[left];
  if (value === undefined) {
    throw new TypeError(`Matching answer is missing value for left item: ${left}`);
  }
  return value;
}

export function getMatchingInteractionItems(
  exercise: MatchingExercise,
  matching: Record<string, string>,
): MatchingInteractionItems {
  const draftLeftItems = Object.keys(matching);

  if (draftLeftItems.length > 0) {
    return {
      leftItems: draftLeftItems,
      rightItems: draftLeftItems.map((left) => getMatchingValue(matching, left)),
    };
  }

  const initialMatching = buildInitialMatchingAnswer(exercise);
  const leftItems = Object.keys(initialMatching);
  return {
    leftItems,
    rightItems: leftItems.map((left) => getMatchingValue(initialMatching, left)),
  };
}
