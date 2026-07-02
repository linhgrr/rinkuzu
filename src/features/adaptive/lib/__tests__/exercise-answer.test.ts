import { describe, expect, it } from 'vitest';
import {
  createInitialExerciseAnswer,
  hasCompleteExerciseAnswer,
} from '@/features/adaptive/lib/exercise-answer';
import { toSubmitAnswerPayload } from '@/features/adaptive/mappers/exercise-answer.mapper';
import type { Exercise } from '@/features/adaptive/types/learning';

function createExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex-1',
    exercise_id: 'ex-1',
    concept_name: 'Concept',
    concept_idx: 0,
    bloom_level: 1,
    bloom_label: 'Remember',
    exercise_type: 'mcq',
    question: 'Question?',
    options: { A: 'Answer A' },
    items: [],
    pairs: [],
    right_items: [],
    step: 0,
    max_steps: 5,
    ...overrides,
  };
}

describe('exercise answer model', () => {
  it('creates a typed ordering draft from the normalized exercise', () => {
    const exercise = createExercise({
      exercise_type: 'ordering',
      options: {},
      items: ['first', 'second'],
    });

    expect(createInitialExerciseAnswer(exercise)).toEqual({
      type: 'ordering',
      items: ['first', 'second'],
    });
  });

  it('maps the UI answer model to the generated backend DTO', () => {
    expect(
      toSubmitAnswerPayload({
        type: 'multi_correct',
        selections: ['A', 'C'],
      }),
    ).toEqual({ choices: ['A', 'C'] });
  });

  it('rejects a draft whose type does not match the exercise', () => {
    const exercise = createExercise();

    expect(() =>
      hasCompleteExerciseAnswer(exercise, {
        type: 'short_answer',
        text: 'answer',
      }),
    ).toThrow('Exercise type mcq does not match answer type short_answer');
  });

  it('requires every matching pair and a non-empty right value', () => {
    const exercise = createExercise({
      exercise_type: 'matching',
      options: {},
      pairs: [
        { left: 'A', right: '1' },
        { left: 'B', right: '2' },
      ],
      right_items: ['2', '1'],
    });

    expect(
      hasCompleteExerciseAnswer(exercise, {
        type: 'matching',
        matches: { A: '2', B: '' },
      }),
    ).toBe(false);
    expect(
      hasCompleteExerciseAnswer(exercise, {
        type: 'matching',
        matches: { A: '2', B: '1' },
      }),
    ).toBe(true);
  });
});
