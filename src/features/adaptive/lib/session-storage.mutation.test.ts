import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSelectedPipelineJob,
  clearSessionExerciseDraft,
  getJobIdForSession,
  getSelectedPipelineFilename,
  getSelectedPipelineJobId,
  getSelectedPipelineTitle,
  getSessionExerciseDraft,
  getSessionExerciseOutcome,
  saveActiveSessionId,
  saveSelectedPipelineJob,
  saveSessionExerciseDraft,
  saveSessionExerciseOutcome,
  saveSessionJobMapping,
} from '@/features/adaptive/lib/session-storage';
import type { Exercise, SubmitResult } from '@/features/adaptive/types/learning';
import type { ExerciseAnswerDraft } from '@/features/adaptive/types/exercise-answer';
import { createMemoryStorage } from '../../../../tests/helpers/storage';

const bloomLabels = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'] as const;

const exerciseTypes = [
  'mcq',
  'true_false',
  'fill_blank',
  'multi_correct',
  'ordering',
  'matching',
  'short_answer',
] as const;

function baseExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'exercise-1',
    exercise_id: 'exercise-1',
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
    step: 1,
    max_steps: 5,
    ...overrides,
  };
}

function baseResult(overrides: Partial<SubmitResult> = {}): SubmitResult {
  return {
    is_correct: true,
    correct_option: 'A',
    explanation: 'Because',
    concept_name: 'Concept',
    bloom_level: 1,
    mastery_after: 0.6,
    avg_mastery: 0.5,
    step: 1,
    session_completed: false,
    stats: {
      total_correct: 1,
      total_answered: 1,
      accuracy: 100,
    },
    ...overrides,
  };
}

describe('session-storage mutation coverage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    vi.stubGlobal('sessionStorage', createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('pipeline selection keys and fallbacks', () => {
    it('persists and clears pipeline job keys independently of active session id', () => {
      saveSelectedPipelineJob({
        jobId: 'job-42',
        filename: 'notes.pdf',
        subjectName: 'Chemistry',
      });
      saveActiveSessionId('session-42');

      expect(localStorage.getItem('al_pipeline_job_id')).toBe('job-42');
      expect(localStorage.getItem('al_pipeline_filename')).toBe('notes.pdf');
      expect(localStorage.getItem('al_pipeline_subject_name')).toBe('Chemistry');
      expect(localStorage.getItem('al_session_id')).toBe('session-42');
      expect(getSelectedPipelineJobId()).toBe('job-42');
      expect(getSelectedPipelineFilename('fallback.pdf')).toBe('notes.pdf');
      expect(getSelectedPipelineTitle('Fallback')).toBe('Chemistry');

      clearSelectedPipelineJob('job-other');
      expect(getSelectedPipelineJobId()).toBe('job-42');

      clearSelectedPipelineJob();
      expect(getSelectedPipelineJobId()).toBeNull();
      expect(getSelectedPipelineFilename('fallback.pdf')).toBe('fallback.pdf');
      expect(getSelectedPipelineTitle('Fallback')).toBe('Fallback');
      expect(localStorage.getItem('al_session_id')).toBe('session-42');
    });

    it('falls back from subject name to filename to the provided default title', () => {
      localStorage.setItem('al_pipeline_filename', 'only-file.pdf');
      expect(getSelectedPipelineTitle('Default title')).toBe('only-file.pdf');

      localStorage.removeItem('al_pipeline_filename');
      expect(getSelectedPipelineTitle('Default title')).toBe('Default title');
    });
  });

  describe('session job map', () => {
    it('removes corrupt maps and returns null for unknown sessions', () => {
      expect(getJobIdForSession('missing')).toBeNull();

      localStorage.setItem('al_session_job_map:v1', '{not-json');
      expect(getJobIdForSession('session-1')).toBeNull();
      expect(localStorage.getItem('al_session_job_map:v1')).toBeNull();

      localStorage.setItem(
        'al_session_job_map:v1',
        JSON.stringify({ session: { jobId: '', updatedAt: 1 } }),
      );
      expect(getJobIdForSession('session')).toBeNull();
      expect(localStorage.getItem('al_session_job_map:v1')).toBeNull();
    });

    it('does not call removeItem when the session job map key is absent', () => {
      const removeItem = vi.spyOn(localStorage, 'removeItem');
      expect(getJobIdForSession('missing')).toBeNull();
      expect(removeItem).not.toHaveBeenCalled();
    });

    it('keeps the 30 most recently updated mappings in descending updatedAt order', () => {
      const now = 2_000_000;
      vi.spyOn(Date, 'now').mockImplementation(() => now);

      for (let index = 0; index < 35; index += 1) {
        vi.spyOn(Date, 'now').mockReturnValue(now + index);
        saveSessionJobMapping(`session-${index}`, `job-${index}`);
      }

      const raw = localStorage.getItem('al_session_job_map:v1');
      expect(raw).not.toBeNull();
      const map = JSON.parse(raw ?? '{}') as Record<string, { jobId: string; updatedAt: number }>;
      const entries = Object.entries(map);
      expect(entries).toHaveLength(30);
      expect(map['session-0']).toBeUndefined();
      expect(map['session-4']).toBeUndefined();
      expect(map['session-5']?.jobId).toBe('job-5');
      expect(map['session-34']?.jobId).toBe('job-34');

      const updatedAts = entries.map(([, value]) => value.updatedAt);
      const sorted = [...updatedAts].sort((a, b) => b - a);
      expect(updatedAts).not.toEqual([...updatedAts].sort((a, b) => a - b));
      expect(Math.max(...updatedAts)).toBe(now + 34);
      expect(Math.min(...updatedAts)).toBe(now + 5);
      const newest = sorted[0];
      const oldest = sorted[sorted.length - 1];
      expect(typeof newest).toBe('number');
      expect(typeof oldest).toBe('number');
      if (typeof newest !== 'number' || typeof oldest !== 'number') {
        throw new Error('expected numeric updatedAt bounds');
      }
      expect(newest).toBeGreaterThan(oldest);

      // Re-save an old session so it re-enters as most recent.
      vi.spyOn(Date, 'now').mockReturnValue(now + 100);
      saveSessionJobMapping('session-0', 'job-0-refreshed');
      expect(getJobIdForSession('session-0')).toBe('job-0-refreshed');
      expect(getJobIdForSession('session-5')).toBeNull();
    });

    it('accepts zero updatedAt values and rejects negative ones', () => {
      localStorage.setItem(
        'al_session_job_map:v1',
        JSON.stringify({ 'session-zero': { jobId: 'job-zero', updatedAt: 0 } }),
      );
      expect(getJobIdForSession('session-zero')).toBe('job-zero');

      localStorage.setItem(
        'al_session_job_map:v1',
        JSON.stringify({ 'session-neg': { jobId: 'job-neg', updatedAt: -1 } }),
      );
      expect(getJobIdForSession('session-neg')).toBeNull();
      expect(localStorage.getItem('al_session_job_map:v1')).toBeNull();
    });
  });

  describe('exercise outcome schema boundaries', () => {
    it('round-trips every bloom label and exercise type', () => {
      for (const bloom_label of bloomLabels) {
        const bloom_level = (bloomLabels.indexOf(bloom_label) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
        const exercise = baseExercise({ bloom_label, bloom_level });
        const result = baseResult({ bloom_level });
        saveSessionExerciseOutcome(`session-${bloom_label}`, { exercise, result });
        expect(getSessionExerciseOutcome(`session-${bloom_label}`)).toEqual({
          exercise,
          result,
        });
      }

      for (const exercise_type of exerciseTypes) {
        const exercise = baseExercise({ exercise_type });
        saveSessionExerciseOutcome(`session-type-${exercise_type}`, {
          exercise,
          result: baseResult(),
        });
        expect(
          getSessionExerciseOutcome(`session-type-${exercise_type}`)?.exercise.exercise_type,
        ).toBe(exercise_type);
      }
    });

    it('rejects invalid bloom labels, levels, and concept indexes', () => {
      const cases: Array<Partial<Exercise>> = [
        { bloom_label: 'Invalid' as Exercise['bloom_label'] },
        { bloom_level: 0 },
        { bloom_level: 7 },
        { concept_idx: -1 },
        { step: -1 },
        { max_steps: 0 },
        { id: '' },
        { exercise_id: '' },
      ];

      for (const [index, override] of cases.entries()) {
        localStorage.setItem(
          `al_session_outcome:v1:bad-${index}`,
          JSON.stringify({
            version: 1,
            result: baseResult(),
            exercise: { ...baseExercise(), ...override },
          }),
        );
        expect(getSessionExerciseOutcome(`bad-${index}`)).toBeNull();
        expect(localStorage.getItem(`al_session_outcome:v1:bad-${index}`)).toBeNull();
      }
    });

    it('preserves optional exercise fields when present and omits them when absent', () => {
      const withOptionals = baseExercise({
        sentence: 'Fill ___.',
        statement: 'The sky is blue.',
        hint: 'Look up',
        rubric: ['clarity'],
        correct_answer: 'A',
        theory: { content: 'Theory body', examples: ['ex1'] },
        recommendation_reason: {
          concept_name: 'Concept',
          bloom_level: 2,
          bloom_label: 'Understand',
          satisfied_prereqs: [{ name: 'prereq', mastery: 0.8 }],
          current_mastery: 0.4,
          next_milestone: 0.7,
        },
      });
      saveSessionExerciseOutcome('session-opt', {
        exercise: withOptionals,
        result: baseResult({ bloom_level: 2 }),
      });
      const loaded = getSessionExerciseOutcome('session-opt');
      expect(loaded?.exercise).toEqual(withOptionals);
      expect(loaded?.exercise.sentence).toBe('Fill ___.');
      expect(loaded?.exercise.statement).toBe('The sky is blue.');
      expect(loaded?.exercise.hint).toBe('Look up');
      expect(loaded?.exercise.rubric).toEqual(['clarity']);
      expect(loaded?.exercise.correct_answer).toBe('A');
      expect(loaded?.exercise.theory).toEqual({ content: 'Theory body', examples: ['ex1'] });
      expect(loaded?.exercise.recommendation_reason).toEqual({
        concept_name: 'Concept',
        bloom_level: 2,
        bloom_label: 'Understand',
        satisfied_prereqs: [{ name: 'prereq', mastery: 0.8 }],
        current_mastery: 0.4,
        next_milestone: 0.7,
      });

      const minimal = baseExercise();
      saveSessionExerciseOutcome('session-min', { exercise: minimal, result: baseResult() });
      const minimalLoaded = getSessionExerciseOutcome('session-min');
      expect(minimalLoaded?.exercise).toEqual(minimal);
      expect(minimalLoaded?.exercise).not.toHaveProperty('sentence');
      expect(minimalLoaded?.exercise).not.toHaveProperty('statement');
      expect(minimalLoaded?.exercise).not.toHaveProperty('hint');
      expect(minimalLoaded?.exercise).not.toHaveProperty('rubric');
      expect(minimalLoaded?.exercise).not.toHaveProperty('correct_answer');
      expect(minimalLoaded?.exercise).not.toHaveProperty('theory');
      expect(minimalLoaded?.exercise).not.toHaveProperty('recommendation_reason');
    });

    it('accepts every correct_answer schema variant and nullable theory', () => {
      // Exclude `undefined` from the property access type so Partial<Exercise>
      // receives only defined optional values under exactOptionalPropertyTypes.
      const variants: Array<Exclude<Exercise['correct_answer'], undefined>> = [
        'A',
        ['A', 'B'],
        true,
        false,
        { left: 'right' },
        null,
      ];
      for (const [index, correct_answer] of variants.entries()) {
        const exercise = baseExercise({ correct_answer, theory: null });
        saveSessionExerciseOutcome(`session-ca-${index}`, {
          exercise,
          result: baseResult(),
        });
        expect(getSessionExerciseOutcome(`session-ca-${index}`)?.exercise.correct_answer).toEqual(
          correct_answer,
        );
        expect(getSessionExerciseOutcome(`session-ca-${index}`)?.exercise.theory).toBeNull();
      }
    });

    it('rejects invalid recommendation bloom levels and pair objects', () => {
      localStorage.setItem(
        'al_session_outcome:v1:bad-rec',
        JSON.stringify({
          version: 1,
          result: baseResult(),
          exercise: {
            ...baseExercise(),
            recommendation_reason: {
              concept_name: 'Concept',
              bloom_level: 0,
              bloom_label: 'Remember',
              satisfied_prereqs: [],
              current_mastery: 0.1,
              next_milestone: 0.2,
            },
          },
        }),
      );
      expect(getSessionExerciseOutcome('bad-rec')).toBeNull();

      localStorage.setItem(
        'al_session_outcome:v1:bad-pairs',
        JSON.stringify({
          version: 1,
          result: baseResult(),
          exercise: {
            ...baseExercise(),
            pairs: [{ left: 'L', right: 'R', extra: true }],
          },
        }),
      );
      expect(getSessionExerciseOutcome('bad-pairs')).toBeNull();
    });

    it('removes corrupt JSON and rejects missing outcome keys', () => {
      expect(getSessionExerciseOutcome('none')).toBeNull();
      localStorage.setItem('al_session_outcome:v1:broken', '{broken');
      expect(getSessionExerciseOutcome('broken')).toBeNull();
      expect(localStorage.getItem('al_session_outcome:v1:broken')).toBeNull();
    });

    it('does not remove storage when an outcome key is simply missing', () => {
      const removeItem = vi.spyOn(localStorage, 'removeItem');
      expect(getSessionExerciseOutcome('absent-key')).toBeNull();
      expect(removeItem).not.toHaveBeenCalled();
    });

    it('rejects invalid submit result bloom levels and negative stats', () => {
      localStorage.setItem(
        'al_session_outcome:v1:bad-result',
        JSON.stringify({
          version: 1,
          result: { ...baseResult(), bloom_level: 0 },
          exercise: baseExercise(),
        }),
      );
      expect(getSessionExerciseOutcome('bad-result')).toBeNull();

      localStorage.setItem(
        'al_session_outcome:v1:bad-stats',
        JSON.stringify({
          version: 1,
          result: {
            ...baseResult(),
            stats: { total_correct: -1, total_answered: 1, accuracy: 0 },
          },
          exercise: baseExercise(),
        }),
      );
      expect(getSessionExerciseOutcome('bad-stats')).toBeNull();
    });
  });

  describe('exercise draft schema boundaries', () => {
    const drafts: ExerciseAnswerDraft[] = [
      { type: 'mcq', selection: 'A' },
      { type: 'mcq', selection: null },
      { type: 'true_false', value: true },
      { type: 'true_false', value: null },
      { type: 'fill_blank', values: ['answer'] },
      { type: 'multi_correct', selections: ['A', 'C'] },
      { type: 'ordering', items: ['a', 'b'] },
      { type: 'matching', matches: { left: 'right' } },
      { type: 'short_answer', text: 'because' },
    ];

    it('round-trips every draft discriminant', () => {
      for (const [index, draft] of drafts.entries()) {
        saveSessionExerciseDraft('session-1', `ex-${index}`, draft);
        expect(getSessionExerciseDraft('session-1', `ex-${index}`)).toEqual(draft);
      }
    });

    it('rejects invalid draft payloads and clears them', () => {
      const invalidPayloads = [
        { version: 1, draft: { type: 'mcq', selection: 1 } },
        { version: 1, draft: { type: 'true_false', value: 'yes' } },
        { version: 1, draft: { type: 'fill_blank', values: ['a', 'b'] } },
        { version: 1, draft: { type: 'fill_blank', values: [] } },
        { version: 1, draft: { type: 'unknown', text: 'x' } },
        { version: 2, draft: { type: 'mcq', selection: 'A' } },
        { version: 1, draft: { type: 'mcq' } },
      ];

      for (const [index, payload] of invalidPayloads.entries()) {
        const key = `al_exercise_draft:v1:session-1:bad-${index}`;
        sessionStorage.setItem(key, JSON.stringify(payload));
        expect(getSessionExerciseDraft('session-1', `bad-${index}`)).toBeNull();
        expect(sessionStorage.getItem(key)).toBeNull();
      }
    });

    it('returns null for missing drafts and clears stored ones', () => {
      expect(getSessionExerciseDraft('session-1', 'missing')).toBeNull();
      saveSessionExerciseDraft('session-1', 'exercise-1', { type: 'short_answer', text: 'x' });
      clearSessionExerciseDraft('session-1', 'exercise-1');
      expect(sessionStorage.getItem('al_exercise_draft:v1:session-1:exercise-1')).toBeNull();
      expect(getSessionExerciseDraft('session-1', 'exercise-1')).toBeNull();
    });

    it('does not remove sessionStorage when a draft key is simply missing', () => {
      const removeItem = vi.spyOn(sessionStorage, 'removeItem');
      expect(getSessionExerciseDraft('session-1', 'no-draft')).toBeNull();
      expect(removeItem).not.toHaveBeenCalled();
    });

    it('removes non-JSON draft caches', () => {
      sessionStorage.setItem('al_exercise_draft:v1:session-1:exercise-1', 'not-json');
      expect(getSessionExerciseDraft('session-1', 'exercise-1')).toBeNull();
      expect(sessionStorage.getItem('al_exercise_draft:v1:session-1:exercise-1')).toBeNull();
    });
  });
});
