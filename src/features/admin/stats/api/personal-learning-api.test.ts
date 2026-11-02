import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchApiDataMock } = vi.hoisted(() => ({ fetchApiDataMock: vi.fn() }));

vi.mock('@/lib/api/client', () => ({ fetchApiData: fetchApiDataMock }));

import {
  fetchLearnerSubjects,
  fetchPersonalLearningSummary,
  searchLearners,
} from '@/features/admin/stats/api/personal-learning-api';

const summaryDto = {
  window: 'all',
  bucket: 'month',
  totals: {
    active_learners: 4,
    subjects_created: 6,
    subjects_completed: 5,
    subjects_with_progress: 3,
    total_answers: 40,
    total_correct: 30,
    weighted_accuracy: 0.75,
    average_mastery: 0.5,
    average_progress: 42,
    mastered_concepts: 7,
  },
  pipeline: {
    total_jobs: 6,
    completed_jobs: 5,
    failed_jobs: 1,
    cancelled_jobs: 0,
    active_jobs: 0,
    partial_successes: 2,
    retryable_failures: 1,
    success_rate: 0.83,
    failure_rate: 0.17,
    average_duration_seconds: 12.5,
  },
  pipeline_statuses: [{ key: 'completed', count: 5 }],
  progress_statuses: [{ key: 'active', count: 3 }],
  top_error_codes: [{ key: 'pdf_unreadable', count: 1 }],
  trend: [
    {
      period: '2026-08',
      jobs_created: 6,
      jobs_completed: 5,
      jobs_failed: 1,
      active_learners: 4,
      answers: 40,
      correct_answers: 30,
    },
  ],
};

describe('personal learning api', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps the summary into grouped view-model sections', async () => {
    fetchApiDataMock.mockResolvedValue(summaryDto);

    const summary = await fetchPersonalLearningSummary('all');

    expect(fetchApiDataMock.mock.calls[0]?.[0]).toBe(
      '/api/admin/personal-learning/summary?window=all',
    );
    expect(fetchApiDataMock.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store' });
    // exactOptionalPropertyTypes: no signal means no `signal` key, not `signal: undefined`.
    expect(Object.keys(fetchApiDataMock.mock.calls[0]?.[1] ?? {})).toEqual(['cache']);
    expect(summary.bucket).toBe('month');
    expect(summary.adoption).toEqual({
      activeLearners: 4,
      subjectsCreated: 6,
      subjectsCompleted: 5,
      subjectsWithProgress: 3,
    });
    expect(summary.outcomes.weightedAccuracy).toBe(0.75);
    expect(summary.pipeline.retryableFailures).toBe(1);
    expect(summary.topErrorCodes).toEqual([{ key: 'pdf_unreadable', count: 1 }]);
    expect(summary.trend[0]).toEqual({
      period: '2026-08',
      jobsCreated: 6,
      jobsCompleted: 5,
      jobsFailed: 1,
      activeLearners: 4,
      answers: 40,
      correctAnswers: 30,
    });
  });

  it('searches learners by an encoded query and keeps only identity fields', async () => {
    fetchApiDataMock.mockResolvedValue({
      learners: [{ id: 'u1', displayName: 'Ana', email: 'ana@example.test', role: 'user' }],
    });

    const learners = await searchLearners('ana&b');

    expect(fetchApiDataMock.mock.calls[0]?.[0]).toBe(
      '/api/admin/personal-learning/learners?search=ana%26b',
    );
    expect(learners).toEqual([{ id: 'u1', displayName: 'Ana', email: 'ana@example.test' }]);
  });

  it('maps the subjects of one learner to the allowlisted row fields', async () => {
    fetchApiDataMock.mockResolvedValue({
      subjects: [
        {
          job_id: 'j1',
          filename: 'notes.pdf',
          pipeline_status: 'completed',
          accuracy: 0.5,
          progress_percent: 40,
          raw_text: 'must not leak',
        },
      ],
      next_cursor: null,
    });

    const subjects = await fetchLearnerSubjects('u1');

    expect(fetchApiDataMock.mock.calls[0]?.[0]).toBe(
      '/api/admin/personal-learning/subjects?user_id=u1&limit=100',
    );
    expect(subjects).toEqual([
      {
        jobId: 'j1',
        filename: 'notes.pdf',
        pipelineStatus: 'completed',
        progressStatus: null,
        accuracy: 0.5,
        progressPercent: 40,
        lastActivityAt: null,
      },
    ]);
  });
});
