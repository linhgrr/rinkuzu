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
  return Object.fromEntries(exercise.pairs.map((pair, index) => [pair.left, rightItems[index]]));
}

export function getMatchingInteractionItems(
  exercise: MatchingExercise,
  matching: Record<string, string>,
): MatchingInteractionItems {
  const draftLeftItems = Object.keys(matching);

  if (draftLeftItems.length > 0) {
    return {
      leftItems: draftLeftItems,
      rightItems: draftLeftItems.map((left) => matching[left]),
    };
  }

  const initialMatching = buildInitialMatchingAnswer(exercise);
  const leftItems = Object.keys(initialMatching);
  return {
    leftItems,
    rightItems: leftItems.map((left) => initialMatching[left]),
  };
}
