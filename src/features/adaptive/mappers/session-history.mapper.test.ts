import { describe, expect, it } from 'vitest';
import { toSessionHistoryViewModels } from './session-history.mapper';
import type { SessionHistoryItem } from '@/features/adaptive/types/history';

const baseSession: SessionHistoryItem = {
  job_id: 'job-123456789',
  filename: 'linear-algebra.pdf',
  subject_id: 'Matrix basics',
  status: 'completed',
  step: 3,
  max_steps: 5,
  total_correct: 4,
  total_answered: 5,
  accuracy: 0.8,
  avg_mastery: 0.72,
  unlocked_concepts: 4,
  locked_concepts: 1,
  mastered_concepts: 3,
  progress_percent: 75,
  updated_at: 1_783_000_000,
  created_at: 1_782_900_000,
  last_session_id: 'session-1',
};

describe('session-history.mapper', () => {
  it('maps adaptive service progress DTO to a camelCase UI model', () => {
    const [viewModel] = toSessionHistoryViewModels([baseSession]);

    expect(viewModel).toEqual({
      jobId: 'job-123456789',
      filename: 'linear-algebra.pdf',
      subjectId: 'Matrix basics',
      displayTitle: 'Matrix basics',
      status: 'completed',
      step: 3,
      maxSteps: 5,
      createdAt: 1_782_900_000,
      updatedAt: 1_783_000_000,
      lastActivityAt: 1_783_000_000,
      totalCorrect: 4,
      totalAnswered: 5,
      accuracyPercent: 80,
      averageMasteryPercent: 72,
      progressPercent: 75,
    });
    expect(viewModel).not.toHaveProperty('job_id');
    expect(viewModel).not.toHaveProperty('subject_id');
    expect(viewModel).not.toHaveProperty('updated_at');
    expect(viewModel).not.toHaveProperty('avg_mastery');
  });

  it('uses filename stem when subject id is empty', () => {
    const [viewModel] = toSessionHistoryViewModels([{ ...baseSession, subject_id: '' }]);
    expect(viewModel?.displayTitle).toBe('linear-algebra');
  });

  it('clamps invalid percentage ratios to display-safe percent values', () => {
    const [viewModel] = toSessionHistoryViewModels([
      {
        ...baseSession,
        accuracy: 1.5,
        avg_mastery: Number.NaN,
      },
    ]);

    expect(viewModel?.accuracyPercent).toBe(100);
    expect(viewModel?.averageMasteryPercent).toBe(0);
  });
});
