import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDashboardSubjectFromJob,
  toDashboardSubject,
} from '@/features/adaptive/mappers/dashboard.mapper';
import type { TranslateFn } from '@/features/adaptive/types/learning';
import type {
  PipelineJobHistoryItem,
  PipelineJobListItem,
} from '@/features/adaptive/types/pipeline';
import type { DashboardSubjectExercise } from '@/features/adaptive/types/dashboard-view-model';
import { formatDate } from '@/lib/formatters';

const t: TranslateFn = (key, values) => {
  if (values && typeof values === 'object' && 'count' in values) {
    return `${key}:${String((values as { count: number }).count)}`;
  }
  return key;
};

const tProcessing: TranslateFn = (key) => `proc:${key}`;

function historyJob(overrides: Partial<PipelineJobHistoryItem> = {}): PipelineJobHistoryItem {
  return {
    job_id: 'job-history-1',
    filename: 'linear-algebra.pdf',
    subject_id: 'Matrix basics',
    status: 'completed',
    concepts_extracted: 10,
    concepts_after_merge: 8,
    relations_accepted: 12,
    relations_llm_verified: 12,
    relations_deterministic_unverified: 0,
    completed_at: 1_700_000_000,
    mastered_concept: 3,
    all_concept: 10,
    unlocked_concept: 5,
    locked_concept: 5,
    progress_percent: 40,
    ...overrides,
  };
}

function listJob(overrides: Partial<PipelineJobListItem> = {}): PipelineJobListItem {
  return {
    job_id: 'job-list-1',
    filename: 'calculus.notes.docx',
    subject_id: 'Derivatives',
    status: 'pending',
    current_step: 'pending',
    progress: 0.25,
    page_batch_size: 10,
    batch_count: 1,
    failed_batch_count: 0,
    partial_success: false,
    concepts_extracted: 0,
    concepts_after_merge: 0,
    relations_accepted: 0,
    relations_llm_verified: 0,
    relations_deterministic_unverified: 0,
    retryable: false,
    retry_count: 0,
    eta_seconds: 90,
    created_at: 1_700_000_000,
    updated_at: 1_700_000_100,
    heartbeat_at: 1_700_000_100,
    completed_at: null,
    is_terminal: false,
    is_delayed: false,
    retry_after_seconds: 3,
    ...overrides,
  };
}

describe('dashboard.mapper mutation coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-17T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('toDashboardSubject', () => {
    it('maps history fields and attaches optional exercise payloads', () => {
      const exercise: DashboardSubjectExercise = {
        status: 'active',
        totalAnswered: 4,
        progressPercent: 25,
      };

      const subject = toDashboardSubject(historyJob(), 'en', t, exercise);

      expect(subject).toMatchObject({
        jobId: 'job-history-1',
        filename: 'linear-algebra.pdf',
        subjectId: 'Matrix basics',
        status: 'completed',
        conceptsExtracted: 10,
        conceptsAfterMerge: 8,
        relationsAccepted: 12,
        completedAt: 1_700_000_000,
        masteredConcept: 3,
        allConcept: 10,
        progressPercent: 40,
        displayTitle: 'Matrix basics',
        progressLabel: 'progressLabel',
        ctaLabel: 'continueLearning',
        runtime: { kind: 'ready' },
        exercise,
        metrics: {
          masteredConcepts: 3,
          allConcepts: 10,
          progressPercent: 40,
          remainingConcepts: 2,
        },
      });
    });

    it('uses filename stem then job id for empty subject titles', () => {
      expect(toDashboardSubject(historyJob({ subject_id: '   ' }), 'en', t).displayTitle).toBe(
        'linear-algebra',
      );

      expect(
        toDashboardSubject(
          historyJob({ subject_id: '', filename: '', job_id: 'fallback-job' }),
          'en',
          t,
        ).displayTitle,
      ).toBe('fallback-job');

      expect(
        toDashboardSubject(historyJob({ filename: 'archive.tar.gz' }), 'en', t).displayTitle,
      ).toBe('Matrix basics');
      expect(
        toDashboardSubject(historyJob({ subject_id: '', filename: 'archive.tar.gz' }), 'en', t)
          .displayTitle,
      ).toBe('archive.tar');
    });

    it('computes metrics from unlocked concepts and clamps progress percent', () => {
      const bounded = toDashboardSubject(
        historyJob({
          unlocked_concept: 4,
          mastered_concept: 9,
          all_concept: 12,
          progress_percent: 150.4,
        }),
        'en',
        t,
      );
      expect(bounded.metrics).toEqual({
        masteredConcepts: 4,
        allConcepts: 12,
        progressPercent: 100,
        remainingConcepts: 0,
      });
      expect(bounded.ctaLabel).toBe('continueLearning');

      const zeroUnlocked = toDashboardSubject(
        historyJob({
          unlocked_concept: 0,
          mastered_concept: 3,
          all_concept: 8,
          progress_percent: -12,
        }),
        'en',
        t,
      );
      expect(zeroUnlocked.metrics).toEqual({
        masteredConcepts: 0,
        allConcepts: 0,
        progressPercent: 0,
        remainingConcepts: 0,
      });
      expect(zeroUnlocked.ctaLabel).toBe('startLearning');

      const nonFinite = toDashboardSubject(
        historyJob({
          unlocked_concept: 0,
          progress_percent: Number.NaN,
        }),
        'en',
        t,
      );
      expect(nonFinite.metrics.progressPercent).toBe(0);
      expect(nonFinite.ctaLabel).toBe('startLearning');
    });

    it('formats lastOpenedLabel across unknown, future, hour, day, and absolute date branches', () => {
      expect(toDashboardSubject(historyJob({ completed_at: 0 }), 'en', t).lastOpenedLabel).toBe(
        'lastOpenedUnknown',
      );
      expect(
        toDashboardSubject(historyJob({ completed_at: Number.NaN }), 'en', t).lastOpenedLabel,
      ).toBe('lastOpenedUnknown');
      expect(toDashboardSubject(historyJob({ completed_at: -5 }), 'en', t).lastOpenedLabel).toBe(
        'lastOpenedUnknown',
      );

      const nowMs = Date.now();

      // seconds-scale timestamp converted to ms (value < 1e12)
      const secondsAgo = Math.floor((nowMs - 30 * 60 * 1000) / 1000);
      expect(
        toDashboardSubject(historyJob({ completed_at: secondsAgo }), 'en', t).lastOpenedLabel,
      ).toBe('openedJustNow');

      const twoHoursAgoMs = nowMs - 2 * 60 * 60 * 1000;
      expect(
        toDashboardSubject(historyJob({ completed_at: twoHoursAgoMs }), 'en', t).lastOpenedLabel,
      ).toBe('openedHoursAgo:2');

      const twentyThreeHoursAgoMs = nowMs - 23 * 60 * 60 * 1000;
      expect(
        toDashboardSubject(historyJob({ completed_at: twentyThreeHoursAgoMs }), 'en', t)
          .lastOpenedLabel,
      ).toBe('openedHoursAgo:23');

      const thirtyHoursAgoMs = nowMs - 30 * 60 * 60 * 1000;
      expect(
        toDashboardSubject(historyJob({ completed_at: thirtyHoursAgoMs }), 'en', t).lastOpenedLabel,
      ).toBe('openedYesterday');

      const threeDaysAgoMs = nowMs - 3 * 24 * 60 * 60 * 1000;
      expect(
        toDashboardSubject(historyJob({ completed_at: threeDaysAgoMs }), 'en', t).lastOpenedLabel,
      ).toBe('openedDaysAgo:3');

      const sevenDaysAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
      expect(
        toDashboardSubject(historyJob({ completed_at: sevenDaysAgoMs }), 'en', t).lastOpenedLabel,
      ).toBe('openedDaysAgo:7');

      const eightDaysAgoMs = nowMs - 8 * 24 * 60 * 60 * 1000;
      expect(
        toDashboardSubject(historyJob({ completed_at: eightDaysAgoMs }), 'vi', t).lastOpenedLabel,
      ).toBe(formatDate(eightDaysAgoMs, { locale: 'vi' }));

      const futureMs = nowMs + 60_000;
      expect(
        toDashboardSubject(historyJob({ completed_at: futureMs }), 'en', t).lastOpenedLabel,
      ).toBe(formatDate(futureMs, { locale: 'en' }));
    });

    it('treats exactly one hour as hours-ago and exactly 24 hours as yesterday', () => {
      const nowMs = Date.now();
      expect(
        toDashboardSubject(historyJob({ completed_at: nowMs - 60 * 60 * 1000 }), 'en', t)
          .lastOpenedLabel,
      ).toBe('openedHoursAgo:1');

      expect(
        toDashboardSubject(historyJob({ completed_at: nowMs - 24 * 60 * 60 * 1000 }), 'en', t)
          .lastOpenedLabel,
      ).toBe('openedYesterday');

      expect(
        toDashboardSubject(historyJob({ completed_at: nowMs - 48 * 60 * 60 * 1000 }), 'en', t)
          .lastOpenedLabel,
      ).toBe('openedDaysAgo:2');
    });
  });

  describe('buildDashboardSubjectFromJob', () => {
    it('maps completed jobs to ready runtime with startLearning CTA when progress is zero', () => {
      const subject = buildDashboardSubjectFromJob(
        listJob({
          status: 'completed',
          progress: 0.4,
          is_terminal: true,
          completed_at: 1_700_000_500,
        }),
        t,
        tProcessing,
      );

      expect(subject).toMatchObject({
        jobId: 'job-list-1',
        displayTitle: 'Derivatives',
        status: 'completed',
        completedAt: 1_700_000_500,
        lastOpenedLabel: 'lastOpenedUnknown',
        progressLabel: 'progressLabel',
        ctaLabel: 'startLearning',
        progressPercent: 0,
        masteredConcept: 0,
        allConcept: 0,
        runtime: { kind: 'ready' },
        exercise: null,
        metrics: {
          masteredConcepts: 0,
          allConcepts: 0,
          progressPercent: 0,
          remainingConcepts: 0,
        },
      });
    });

    it('maps failed and cancelled jobs to retryable runtime with fallback messages', () => {
      const failed = buildDashboardSubjectFromJob(
        listJob({
          status: 'failed',
          user_message: 'Graph build failed',
          is_terminal: true,
        }),
        t,
        tProcessing,
      );
      expect(failed.runtime).toEqual({
        kind: 'retryable',
        message: 'Graph build failed',
      });
      expect(failed.ctaLabel).toBe('proc:processing.status.processing');

      const cancelled = buildDashboardSubjectFromJob(
        listJob({
          status: 'cancelled',
          user_message: null,
          is_terminal: true,
        }),
        t,
        tProcessing,
      );
      expect(cancelled.runtime).toEqual({
        kind: 'retryable',
        message: 'proc:processing.errors.pipelineFailed',
      });
    });

    it('maps every in-flight pipeline status to processing runtime with stage labels and clamped progress', () => {
      const statuses = [
        'pending',
        'queued',
        'loading',
        'chunking',
        'extracting',
        'embedding',
        'merging',
        'ranking',
        'verifying',
        'building_graph',
        'optimizing',
      ] as const;

      for (const status of statuses) {
        const subject = buildDashboardSubjectFromJob(
          listJob({
            status,
            progress: 1.25,
            eta_seconds: status === 'pending' ? null : 12,
          }),
          t,
          tProcessing,
        );

        expect(subject.runtime).toEqual({
          kind: 'processing',
          progressPercent: 100,
          stageLabel: `proc:processing.status.${
            {
              pending: 'waitingToStart',
              queued: 'queuedForProcessing',
              loading: 'readingDocument',
              chunking: 'splittingChunks',
              extracting: 'extractingConceptsWithAI',
              embedding: 'computingEmbeddings',
              merging: 'mergingDuplicateConcepts',
              ranking: 'rankingPrerequisites',
              verifying: 'verifyingRelationsWithAI',
              building_graph: 'buildingKnowledgeGraph',
              optimizing: 'optimizingDAG',
            }[status]
          }`,
          etaSeconds: status === 'pending' ? null : 12,
        });
        expect(subject.progressPercent).toBe(100);
        expect(subject.ctaLabel).toBe('proc:processing.status.processing');
        expect(subject.metrics.progressPercent).toBe(100);
      }
    });

    it('uses filename stem for job titles and rejects unsupported statuses', () => {
      expect(
        buildDashboardSubjectFromJob(listJob({ subject_id: '', filename: 'notes.final.pdf' }), t)
          .displayTitle,
      ).toBe('notes.final');

      expect(() =>
        buildDashboardSubjectFromJob(
          listJob({ status: 'not-a-status' as PipelineJobListItem['status'] }),
          t,
        ),
      ).toThrow(TypeError);
      expect(() =>
        buildDashboardSubjectFromJob(
          listJob({ status: 'not-a-status' as PipelineJobListItem['status'] }),
          t,
        ),
      ).toThrow('Unsupported adaptive pipeline status: not-a-status');
    });

    it('defaults tProcessing to t and rounds mid-range progress percentages', () => {
      const subject = buildDashboardSubjectFromJob(
        listJob({
          status: 'extracting',
          progress: 0.334,
        }),
        t,
      );

      expect(subject.runtime).toMatchObject({
        kind: 'processing',
        progressPercent: 33,
        stageLabel: 'processing.status.extractingConceptsWithAI',
      });
      expect(subject.ctaLabel).toBe('processing.status.processing');
    });
  });
});
