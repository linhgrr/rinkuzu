import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSelectedPipelineJob,
  clearSessionExerciseDraft,
  getJobIdForSession,
  getSelectedPipelineFilename,
  getSelectedPipelineJobId,
  getSelectedPipelineTitle,
  getSessionExerciseDraft,
  getSessionExerciseOutcome,
  getSubjectTitleForSession,
  saveActiveSessionId,
  saveSessionExerciseDraft,
  saveSessionExerciseOutcome,
  saveSessionJobMapping,
  saveSelectedPipelineJob,
} from '@/features/adaptive/lib/session-storage';
import type { Exercise, SubmitResult } from '@/features/adaptive/types/learning';
import { createMemoryStorage } from '../../../../../tests/helpers/storage';

const exercise: Exercise = {
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
};

const result: SubmitResult = {
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
};

describe('adaptive session storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    vi.stubGlobal('sessionStorage', createMemoryStorage());
  });

  it('round-trips a versioned validated exercise outcome', () => {
    saveSessionExerciseOutcome('session-1', { exercise, result });
    expect(getSessionExerciseOutcome('session-1')).toEqual({ exercise, result });
  });

  it('removes corrupt versioned outcome caches', () => {
    localStorage.setItem(
      'al_session_outcome:v1:session-1',
      JSON.stringify({ version: 1, result, exercise: { ...exercise, options: undefined } }),
    );

    expect(getSessionExerciseOutcome('session-1')).toBeNull();
    expect(localStorage.getItem('al_session_outcome:v1:session-1')).toBeNull();
  });

  it('round-trips a versioned session exercise draft in session storage', () => {
    saveSessionExerciseDraft('session-1', 'exercise-1', { type: 'mcq', selection: 'A' });

    expect(getSessionExerciseDraft('session-1', 'exercise-1')).toEqual({
      type: 'mcq',
      selection: 'A',
    });

    clearSessionExerciseDraft('session-1', 'exercise-1');
    expect(getSessionExerciseDraft('session-1', 'exercise-1')).toBeNull();
  });

  it('removes corrupt versioned exercise draft caches', () => {
    sessionStorage.setItem(
      'al_exercise_draft:v1:session-1:exercise-1',
      JSON.stringify({ version: 1, draft: { type: 'mcq', selection: 1 } }),
    );

    expect(getSessionExerciseDraft('session-1', 'exercise-1')).toBeNull();
    expect(sessionStorage.getItem('al_exercise_draft:v1:session-1:exercise-1')).toBeNull();
  });

  it('stores only validated versioned session-to-job mappings', () => {
    saveSessionJobMapping('session-1', 'job-1', {
      filename: 'biology.pdf',
      subjectName: 'Biology',
    });

    expect(getJobIdForSession('session-1')).toBe('job-1');
    expect(getSubjectTitleForSession('session-1', 'Learning Path')).toBe('Biology');
    expect(localStorage.getItem('al_session_job_map:v1')).toContain('session-1');
  });

  it('does not leak the selected title into an unrelated session', () => {
    saveSessionJobMapping('session-1', 'job-1');
    saveSelectedPipelineJob({
      jobId: 'job-2',
      filename: 'chemistry.pdf',
      subjectName: 'Chemistry',
    });

    expect(getSubjectTitleForSession('session-1', 'Learning Path')).toBe('Learning Path');
  });

  it('centralizes selected pipeline job and active session browser state', () => {
    saveSelectedPipelineJob({
      jobId: 'job-1',
      filename: 'lesson.pdf',
      subjectName: 'Biology',
    });
    saveActiveSessionId('session-1');

    expect(getSelectedPipelineJobId()).toBe('job-1');
    expect(getSelectedPipelineFilename('default.pdf')).toBe('lesson.pdf');
    expect(getSelectedPipelineTitle('Default subject')).toBe('Biology');
    expect(localStorage.getItem('al_session_id')).toBe('session-1');

    clearSelectedPipelineJob('other-job');
    expect(getSelectedPipelineJobId()).toBe('job-1');

    clearSelectedPipelineJob('job-1');
    expect(getSelectedPipelineJobId()).toBeNull();
    expect(getSelectedPipelineFilename('default.pdf')).toBe('default.pdf');
    expect(getSelectedPipelineTitle('Default subject')).toBe('Default subject');
  });
});
