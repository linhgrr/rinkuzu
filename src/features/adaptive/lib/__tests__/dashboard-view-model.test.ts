import { describe, it, expect } from 'vitest';
import enMessages from '@/../messages/en/adaptiveLearning.json';
import viMessages from '@/../messages/vi/adaptiveLearning.json';
import {
  buildDashboardSubjectFromJob,
  toDashboardSubject,
} from '@/features/adaptive/mappers/dashboard.mapper';
import type { DashboardPipelineJobListItem } from '@/features/adaptive/types/dashboard-view-model';
import type { TranslateFn } from '@/features/adaptive/types/learning';
import type { PipelineJobHistoryItem } from '@/features/adaptive/types/pipeline';

const t: TranslateFn = (key) => key;

function pipelineJob(
  overrides: Partial<DashboardPipelineJobListItem> = {},
): DashboardPipelineJobListItem {
  return {
    job_id: 'a',
    filename: 'x.pdf',
    subject_id: 'x',
    status: 'queued',
    current_step: '',
    progress: 0,
    page_batch_size: 10,
    batch_count: 0,
    failed_batch_count: 0,
    partial_success: false,
    concepts_extracted: 0,
    concepts_after_merge: 0,
    relations_accepted: 0,
    relations_llm_verified: 0,
    relations_deterministic_unverified: 0,
    retryable: false,
    retry_count: 0,
    eta_seconds: null,
    created_at: 0,
    updated_at: 0,
    heartbeat_at: 0,
    completed_at: null,
    is_terminal: false,
    is_delayed: false,
    retry_after_seconds: 3,
    ...overrides,
  };
}

/**
 * Build a translator scoped to `ns` that walks the real nested messages and
 * THROWS on a missing key — mirroring next-intl's behaviour of surfacing the
 * raw key path. Used to prove every key the view-model requests resolves to a
 * real localized string in BOTH locales.
 */
function makeT(ns: Record<string, unknown>): TranslateFn {
  return ((key: string) => {
    const val = key
      .split('.')
      .reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], ns);
    if (typeof val !== 'string') throw new Error(`Missing i18n key: ${key}`);
    return val;
  }) as TranslateFn;
}

// ---------------------------------------------------------------------------
// buildDashboardSubjectFromJob
// ---------------------------------------------------------------------------
describe('buildDashboardSubjectFromJob', () => {
  it('maps a processing job to a processing runtime', () => {
    const vm = buildDashboardSubjectFromJob(
      pipelineJob({
        status: 'extracting',
        progress: 0.3,
        eta_seconds: 120,
      }),
      t,
    );
    expect(vm.runtime.kind).toBe('processing');
    if (vm.runtime.kind === 'processing') {
      expect(vm.runtime.progressPercent).toBe(30);
      expect(vm.runtime.etaSeconds).toBe(120);
    }
  });

  it('maps a failed job to a retryable runtime', () => {
    const vm = buildDashboardSubjectFromJob(
      pipelineJob({
        status: 'failed',
        progress: 0,
        retryable: true,
        user_message: 'boom',
      }),
      t,
    );
    expect(vm.runtime.kind).toBe('retryable');
    if (vm.runtime.kind === 'retryable') expect(vm.runtime.message).toBe('boom');
  });

  it('maps a completed job to a ready runtime', () => {
    const vm = buildDashboardSubjectFromJob(
      pipelineJob({
        status: 'completed',
        progress: 1,
      }),
      t,
    );
    expect(vm.runtime.kind).toBe('ready');
  });

  it('uses job_id as displayTitle when subject_id and filename are empty', () => {
    const vm = buildDashboardSubjectFromJob(
      pipelineJob({
        job_id: 'job-123',
        filename: '',
        subject_id: '',
        status: 'queued',
        progress: 0,
        eta_seconds: null,
      }),
      t,
    );
    expect(vm.displayTitle).toBe('job-123');
  });

  it('strips file extension from filename for displayTitle', () => {
    const vm = buildDashboardSubjectFromJob(
      pipelineJob({
        job_id: 'j',
        filename: 'lecture.pdf',
        subject_id: '',
        status: 'queued',
        progress: 0,
        eta_seconds: null,
      }),
      t,
    );
    expect(vm.displayTitle).toBe('lecture');
  });

  it('prefers subject_id over filename for displayTitle', () => {
    const vm = buildDashboardSubjectFromJob(
      pipelineJob({
        job_id: 'j',
        filename: 'lecture.pdf',
        subject_id: 'subj-1',
        status: 'queued',
        progress: 0,
        eta_seconds: null,
      }),
      t,
    );
    expect(vm.displayTitle).toBe('subj-1');
  });

  it('maps a cancelled job to retryable runtime using fallback message when user_message is null', () => {
    const vm = buildDashboardSubjectFromJob(
      pipelineJob({
        status: 'cancelled',
        progress: 0,
        user_message: null,
      }),
      t,
    );
    expect(vm.runtime.kind).toBe('retryable');
    if (vm.runtime.kind === 'retryable') {
      expect(vm.runtime.message).toBe('processing.errors.pipelineFailed');
    }
  });

  it('does not infer mastery progress for completed jobs without enriched history', () => {
    const vm = buildDashboardSubjectFromJob(
      pipelineJob({
        status: 'completed',
        progress: 1,
      }),
      t,
    );
    expect(vm.metrics.progressPercent).toBe(0);
    expect(vm.ctaLabel).toBe('startLearning');
  });

  it('clamps progressPercent for in-flight jobs', () => {
    const vm = buildDashboardSubjectFromJob(
      pipelineJob({
        status: 'embedding',
        progress: 0.55,
        eta_seconds: null,
      }),
      t,
      t,
    );
    expect(vm.metrics.progressPercent).toBe(55);
    if (vm.runtime.kind === 'processing') {
      expect(vm.runtime.progressPercent).toBe(55);
    }
  });
});

// ---------------------------------------------------------------------------
// Regression: every i18n key the processing/failed cards request must resolve
// against the REAL message catalogue in BOTH locales (no raw key paths).
// `t` is dashboard-scoped (adaptiveLearning.dashboard), `tProcessing` is
// top-level (adaptiveLearning) — exactly as wired in Dashboard.tsx.
// ---------------------------------------------------------------------------
describe('buildDashboardSubjectFromJob i18n key resolution', () => {
  const locales: Array<[string, Record<string, unknown>]> = [
    ['en', enMessages as Record<string, unknown>],
    ['vi', viMessages as Record<string, unknown>],
  ];

  for (const [locale, messages] of locales) {
    const tDashboard = makeT((messages as { dashboard: Record<string, unknown> }).dashboard);
    const tProcessing = makeT(messages);

    it(`resolves processing-job stageLabel to a real string [${locale}]`, () => {
      const vm = buildDashboardSubjectFromJob(
        pipelineJob({
          status: 'extracting',
          progress: 0.3,
          eta_seconds: 120,
        }),
        tDashboard,
        tProcessing,
      );
      expect(vm.runtime.kind).toBe('processing');
      if (vm.runtime.kind === 'processing') {
        expect(vm.runtime.stageLabel).not.toContain('processing.status.');
        expect(vm.runtime.stageLabel.length).toBeGreaterThan(0);
      }
      // ctaLabel for in-flight jobs uses processing.status.processing
      expect(vm.ctaLabel).not.toContain('processing.status.');
    });

    it(`resolves failed-job message to a real string [${locale}]`, () => {
      const vm = buildDashboardSubjectFromJob(
        pipelineJob({
          status: 'failed',
          progress: 0,
          user_message: null,
        }),
        tDashboard,
        tProcessing,
      );
      expect(vm.runtime.kind).toBe('retryable');
      if (vm.runtime.kind === 'retryable') {
        expect(vm.runtime.message).not.toContain('processing.errors.');
        expect(vm.runtime.message.length).toBeGreaterThan(0);
      }
    });

    it(`rejects status values outside the generated backend contract [${locale}]`, () => {
      const invalidJob = pipelineJob({
        progress: 0.1,
        eta_seconds: null,
        // @ts-expect-error Intentional contract-violation fixture: generated backend status rejects this.
        status: 'some_future_status',
      });

      expect(() => buildDashboardSubjectFromJob(invalidJob, tDashboard, tProcessing)).toThrow(
        'Unsupported adaptive pipeline status: some_future_status',
      );
    });

    it(`resolves queued-job stageLabel from the generated backend contract [${locale}]`, () => {
      const vm = buildDashboardSubjectFromJob(
        pipelineJob({
          status: 'queued',
          progress: 0.1,
          eta_seconds: null,
        }),
        tDashboard,
        tProcessing,
      );
      expect(vm.runtime.kind).toBe('processing');
      if (vm.runtime.kind === 'processing') {
        expect(vm.runtime.stageLabel).not.toContain('processing.status.');
        expect(vm.runtime.stageLabel.length).toBeGreaterThan(0);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// toDashboardSubject (existing builder — must remain unchanged except runtime)
// ---------------------------------------------------------------------------
describe('toDashboardSubject', () => {
  const baseJob: PipelineJobHistoryItem = {
    job_id: 'j1',
    filename: 'intro.pdf',
    subject_id: 'subj-intro',
    status: 'completed',
    concepts_extracted: 10,
    concepts_after_merge: 8,
    relations_accepted: 5,
    relations_llm_verified: 5,
    relations_deterministic_unverified: 0,
    completed_at: 1_700_000_000,
    mastered_concept: 4,
    all_concept: 8,
    unlocked_concept: 8,
    locked_concept: 0,
    progress_percent: 50,
  };

  it('sets runtime to ready', () => {
    const vm = toDashboardSubject(baseJob, 'en', t);
    expect(vm.runtime).toEqual({ kind: 'ready' });
  });

  it('maps generated backend fields to a camelCase dashboard view-model', () => {
    const vm = toDashboardSubject(baseJob, 'en', t);

    expect(vm).toMatchObject({
      jobId: 'j1',
      subjectId: 'subj-intro',
      conceptsExtracted: 10,
      conceptsAfterMerge: 8,
      relationsAccepted: 5,
      completedAt: 1_700_000_000,
      masteredConcept: 4,
      allConcept: 8,
      progressPercent: 50,
    });
    expect(vm).not.toHaveProperty('job_id');
    expect(vm).not.toHaveProperty('subject_id');
    expect(vm).not.toHaveProperty('concepts_extracted');
    expect(vm).not.toHaveProperty('concepts_after_merge');
    expect(vm).not.toHaveProperty('relations_accepted');
    expect(vm).not.toHaveProperty('completed_at');
    expect(vm).not.toHaveProperty('progress_percent');
  });

  it('derives displayTitle from subject_id', () => {
    const vm = toDashboardSubject(baseJob, 'en', t);
    expect(vm.displayTitle).toBe('subj-intro');
  });

  it('falls back to filename stem when subject_id is empty', () => {
    const vm = toDashboardSubject({ ...baseJob, subject_id: '' }, 'en', t);
    expect(vm.displayTitle).toBe('intro');
  });

  it('uses backend progressPercent computed from unlocked concepts', () => {
    const vm = toDashboardSubject(
      {
        ...baseJob,
        mastered_concept: 2,
        all_concept: 8,
        unlocked_concept: 4,
        progress_percent: 50,
      },
      'en',
      t,
    );
    expect(vm.metrics.progressPercent).toBe(50);
    expect(vm.metrics.remainingConcepts).toBe(2);
  });

  it('keeps total concept count separate from unlocked progress denominator', () => {
    const vm = toDashboardSubject(baseJob, 'en', t);
    expect(vm.metrics.allConcepts).toBe(8);
  });

  it('uses continueLearning cta when progress > 0', () => {
    const vm = toDashboardSubject(baseJob, 'en', t);
    expect(vm.ctaLabel).toBe('continueLearning');
  });

  it('uses startLearning cta when progress is 0', () => {
    const vm = toDashboardSubject(
      {
        ...baseJob,
        mastered_concept: 0,
        all_concept: 0,
        unlocked_concept: 0,
        locked_concept: 0,
        progress_percent: 0,
      },
      'en',
      t,
    );
    expect(vm.ctaLabel).toBe('startLearning');
  });

  it('returns lastOpenedUnknown when completed_at is 0', () => {
    const vm = toDashboardSubject({ ...baseJob, completed_at: 0 }, 'en', t);
    expect(vm.lastOpenedLabel).toBe('lastOpenedUnknown');
  });
});
