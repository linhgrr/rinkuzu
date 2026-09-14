import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchApiDataMock } = vi.hoisted(() => ({ fetchApiDataMock: vi.fn() }));

vi.mock('@/lib/api/client', () => ({ fetchApiData: fetchApiDataMock }));

import {
  fetchPersonalLearningSubjects,
  fetchPersonalLearningSummary,
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

const subjectDto = {
  job_id: 'job-1',
  user_id: 'user-a',
  display_name: 'Learner A',
  email: 'a@example.com',
  filename: 'calculus.pdf',
  subject_id: 'subject-1',
  pipeline_status: 'completed',
  progress_status: 'active',
  safe_error_code: null,
  retryable: false,
  partial_success: true,
  concepts_extracted: 20,
  concepts_after_merge: 18,
  relations_accepted: 30,
  total_answers: 10,
  total_correct: 8,
  accuracy: 0.8,
  average_mastery: 0.55,
  progress_percent: 40,
  mastered_concepts: 4,
  last_session_id: 'session-1',
  duration_seconds: 12.5,
  created_at: '2026-08-01T00:00:00Z',
  completed_at: '2026-08-01T00:05:00Z',
  last_activity_at: '2026-08-02T00:00:00Z',
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

  it('sends only the filters that are set', async () => {
    fetchApiDataMock.mockResolvedValue({ subjects: [], next_cursor: null });

    await fetchPersonalLearningSubjects({
      window: '7d',
      search: 'linh',
      pipelineStatus: 'failed',
      limit: 10,
    });

    const url = String(fetchApiDataMock.mock.calls[0]?.[0]);
    expect(url).toContain('window=7d');
    expect(url).toContain('search=linh');
    expect(url).toContain('pipeline_status=failed');
    expect(url).toContain('limit=10');
    expect(url).not.toContain('progress_status');
    expect(url).not.toContain('cursor');
  });

  it('maps subject rows and keeps a missing identity as null', async () => {
    const { display_name: _name, email: _email, ...anonymous } = subjectDto;
    fetchApiDataMock.mockResolvedValue({
      subjects: [subjectDto, { ...anonymous, job_id: 'job-2', user_id: null }],
      next_cursor: 'cursor-2',
    });

    const page = await fetchPersonalLearningSubjects({ window: '30d' });

    expect(page.nextCursor).toBe('cursor-2');
    expect(page.subjects[0]).toMatchObject({
      jobId: 'job-1',
      displayName: 'Learner A',
      email: 'a@example.com',
      accuracy: 0.8,
      progressPercent: 40,
      lastSessionId: 'session-1',
    });
    expect(page.subjects[1]).toMatchObject({
      jobId: 'job-2',
      userId: null,
      displayName: null,
      email: null,
    });
  });
});
