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
  it('creates typed initial drafts for every exercise discriminant', () => {
    expect(createInitialExerciseAnswer(createExercise({ exercise_type: 'mcq' }))).toEqual({
      type: 'mcq',
      selection: null,
    });
    expect(
      createInitialExerciseAnswer(createExercise({ exercise_type: 'true_false', options: {} })),
    ).toEqual({ type: 'true_false', value: null });
    expect(
      createInitialExerciseAnswer(createExercise({ exercise_type: 'fill_blank', options: {} })),
    ).toEqual({ type: 'fill_blank', values: [''] });
    expect(
      createInitialExerciseAnswer(createExercise({ exercise_type: 'multi_correct', options: {} })),
    ).toEqual({ type: 'multi_correct', selections: [] });
    expect(
      createInitialExerciseAnswer(
        createExercise({
          exercise_type: 'ordering',
          options: {},
          items: ['first', 'second'],
        }),
      ),
    ).toEqual({ type: 'ordering', items: ['first', 'second'] });
    expect(
      createInitialExerciseAnswer(
        createExercise({
          exercise_type: 'matching',
          options: {},
          pairs: [
            { left: 'A', right: '1' },
            { left: 'B', right: '2' },
          ],
          right_items: ['2', '1'],
        }),
      ),
    ).toEqual({ type: 'matching', matches: { A: '2', B: '1' } });
    expect(
      createInitialExerciseAnswer(createExercise({ exercise_type: 'short_answer', options: {} })),
    ).toEqual({ type: 'short_answer', text: '' });
  });

  it('copies ordering items so later mutations do not alias the exercise array', () => {
    const items = ['first', 'second'];
    const exercise = createExercise({
      exercise_type: 'ordering',
      options: {},
      items,
    });
    const draft = createInitialExerciseAnswer(exercise);
    if (draft.type !== 'ordering') throw new Error('expected ordering draft');
    draft.items.push('third');
    expect(exercise.items).toEqual(['first', 'second']);
  });

  it('maps every UI answer discriminant to the submit payload field', () => {
    expect(toSubmitAnswerPayload({ type: 'mcq', selection: 'A' })).toEqual({ choice: 'A' });
    expect(toSubmitAnswerPayload({ type: 'true_false', value: true })).toEqual({ boolean: true });
    expect(toSubmitAnswerPayload({ type: 'fill_blank', values: ['x'] })).toEqual({ blanks: ['x'] });
    expect(toSubmitAnswerPayload({ type: 'multi_correct', selections: ['A', 'C'] })).toEqual({
      choices: ['A', 'C'],
    });
    expect(toSubmitAnswerPayload({ type: 'ordering', items: ['a', 'b'] })).toEqual({
      ordering: ['a', 'b'],
    });
    expect(toSubmitAnswerPayload({ type: 'matching', matches: { A: '1' } })).toEqual({
      matching: { A: '1' },
    });
    expect(toSubmitAnswerPayload({ type: 'short_answer', text: 'because' })).toEqual({
      text: 'because',
    });
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

  it('evaluates completeness branch-by-branch for non-matching types', () => {
    expect(
      hasCompleteExerciseAnswer(createExercise({ exercise_type: 'mcq' }), {
        type: 'mcq',
        selection: null,
      }),
    ).toBe(false);
    expect(
      hasCompleteExerciseAnswer(createExercise({ exercise_type: 'mcq' }), {
        type: 'mcq',
        selection: '',
      }),
    ).toBe(false);
    expect(
      hasCompleteExerciseAnswer(createExercise({ exercise_type: 'mcq' }), {
        type: 'mcq',
        selection: 'A',
      }),
    ).toBe(true);

    expect(
      hasCompleteExerciseAnswer(createExercise({ exercise_type: 'true_false', options: {} }), {
        type: 'true_false',
        value: null,
      }),
    ).toBe(false);
    expect(
      hasCompleteExerciseAnswer(createExercise({ exercise_type: 'true_false', options: {} }), {
        type: 'true_false',
        value: false,
      }),
    ).toBe(true);

    expect(
      hasCompleteExerciseAnswer(createExercise({ exercise_type: 'fill_blank', options: {} }), {
        type: 'fill_blank',
        values: ['   '],
      }),
    ).toBe(false);
    expect(
      hasCompleteExerciseAnswer(createExercise({ exercise_type: 'fill_blank', options: {} }), {
        type: 'fill_blank',
        values: ['  answer  '],
      }),
    ).toBe(true);

    expect(
      hasCompleteExerciseAnswer(createExercise({ exercise_type: 'multi_correct', options: {} }), {
        type: 'multi_correct',
        selections: [],
      }),
    ).toBe(false);
    expect(
      hasCompleteExerciseAnswer(createExercise({ exercise_type: 'multi_correct', options: {} }), {
        type: 'multi_correct',
        selections: ['A'],
      }),
    ).toBe(true);

    const ordering = createExercise({
      exercise_type: 'ordering',
      options: {},
      items: ['a', 'b'],
    });
    expect(hasCompleteExerciseAnswer(ordering, { type: 'ordering', items: ['a'] })).toBe(false);
    expect(hasCompleteExerciseAnswer(ordering, { type: 'ordering', items: ['b', 'a'] })).toBe(true);

    expect(
      hasCompleteExerciseAnswer(createExercise({ exercise_type: 'short_answer', options: {} }), {
        type: 'short_answer',
        text: '   ',
      }),
    ).toBe(false);
    expect(
      hasCompleteExerciseAnswer(createExercise({ exercise_type: 'short_answer', options: {} }), {
        type: 'short_answer',
        text: ' because ',
      }),
    ).toBe(true);
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
        matches: { A: '2' },
      }),
    ).toBe(false);
    expect(
      hasCompleteExerciseAnswer(exercise, {
        type: 'matching',
        matches: { A: '2', B: '1', C: '3' },
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
