import { describe, it, expect } from 'vitest';
import enMessages from '@/../messages/en/adaptiveLearning.json';
import viMessages from '@/../messages/vi/adaptiveLearning.json';
import {
  buildDashboardSubjectFromJob,
  toDashboardSubject,
} from '@/features/adaptive/lib/dashboard-view-model';
import type { PipelineJobHistoryItem, TranslateFn } from '@/features/adaptive/types';

const t = ((k: string) => k) as never;

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
      {
        job_id: 'a',
        filename: 'x.pdf',
        subject_id: 'x',
        status: 'extracting',
        progress: 0.3,
        eta_seconds: 120,
      } as never,
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
      {
        job_id: 'a',
        filename: 'x.pdf',
        subject_id: 'x',
        status: 'failed',
        progress: 0,
        retryable: true,
        user_message: 'boom',
      } as never,
      t,
    );
    expect(vm.runtime.kind).toBe('retryable');
    if (vm.runtime.kind === 'retryable') expect(vm.runtime.message).toBe('boom');
  });

  it('maps a completed job to a ready runtime', () => {
    const vm = buildDashboardSubjectFromJob(
      {
        job_id: 'a',
        filename: 'x.pdf',
        subject_id: 'x',
        status: 'completed',
        progress: 1,
      } as never,
      t,
    );
    expect(vm.runtime.kind).toBe('ready');
  });

  it('uses job_id as displayTitle when subject_id and filename are empty', () => {
    const vm = buildDashboardSubjectFromJob(
      {
        job_id: 'job-123',
        filename: '',
        subject_id: '',
        status: 'queued',
        progress: 0,
        eta_seconds: null,
      } as never,
      t,
    );
    expect(vm.displayTitle).toBe('job-123');
  });

  it('strips file extension from filename for displayTitle', () => {
    const vm = buildDashboardSubjectFromJob(
      {
        job_id: 'j',
        filename: 'lecture.pdf',
        subject_id: '',
        status: 'queued',
        progress: 0,
        eta_seconds: null,
      } as never,
      t,
    );
    expect(vm.displayTitle).toBe('lecture');
  });

  it('prefers subject_id over filename for displayTitle', () => {
    const vm = buildDashboardSubjectFromJob(
      {
        job_id: 'j',
        filename: 'lecture.pdf',
        subject_id: 'subj-1',
        status: 'queued',
        progress: 0,
        eta_seconds: null,
      } as never,
      t,
    );
    expect(vm.displayTitle).toBe('subj-1');
  });

  it('maps a cancelled job to retryable runtime using fallback message when user_message is null', () => {
    const vm = buildDashboardSubjectFromJob(
      {
        job_id: 'a',
        filename: 'x.pdf',
        subject_id: 'x',
        status: 'cancelled',
        progress: 0,
        user_message: null,
      } as never,
      t,
    );
    expect(vm.runtime.kind).toBe('retryable');
    if (vm.runtime.kind === 'retryable') {
      expect(vm.runtime.message).toBe('processing.errors.pipelineFailed');
    }
  });

  it('sets progressPercent 100 for completed jobs', () => {
    const vm = buildDashboardSubjectFromJob(
      {
        job_id: 'a',
        filename: 'x.pdf',
        subject_id: 'x',
        status: 'completed',
        progress: 1,
      } as never,
      t,
    );
    expect(vm.metrics.progressPercent).toBe(100);
  });

  it('clamps progressPercent for in-flight jobs', () => {
    const vm = buildDashboardSubjectFromJob(
      {
        job_id: 'a',
        filename: 'x.pdf',
        subject_id: 'x',
        status: 'embedding',
        progress: 0.55,
        eta_seconds: null,
      } as never,
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
        {
          job_id: 'a',
          filename: 'x.pdf',
          subject_id: 'x',
          status: 'extracting',
          progress: 0.3,
          eta_seconds: 120,
        } as never,
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
        {
          job_id: 'a',
          filename: 'x.pdf',
          subject_id: 'x',
          status: 'failed',
          progress: 0,
          user_message: null,
        } as never,
        tDashboard,
        tProcessing,
      );
      expect(vm.runtime.kind).toBe('retryable');
      if (vm.runtime.kind === 'retryable') {
        expect(vm.runtime.message).not.toContain('processing.errors.');
        expect(vm.runtime.message.length).toBeGreaterThan(0);
      }
    });

    it(`resolves unknown-status stageLabel without throwing [${locale}]`, () => {
      const vm = buildDashboardSubjectFromJob(
        {
          job_id: 'a',
          filename: 'x.pdf',
          subject_id: 'x',
          status: 'some_future_status',
          progress: 0.1,
          eta_seconds: null,
        } as never,
        tDashboard,
        tProcessing,
      );
      expect(vm.runtime.kind).toBe('processing');
      if (vm.runtime.kind === 'processing') {
        expect(vm.runtime.stageLabel).not.toContain('processing.status.');
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
    relations_verified: 5,
    completed_at: 1_700_000_000,
    mastered_concept: 4,
    all_concept: 8,
    progress_percent: 50,
  } as unknown as PipelineJobHistoryItem;

  it('sets runtime to ready', () => {
    const vm = toDashboardSubject(baseJob, 'en', t);
    expect(vm.runtime).toEqual({ kind: 'ready' });
  });

  it('derives displayTitle from subject_id', () => {
    const vm = toDashboardSubject(baseJob, 'en', t);
    expect(vm.displayTitle).toBe('subj-intro');
  });

  it('falls back to filename stem when subject_id is empty', () => {
    const vm = toDashboardSubject({ ...baseJob, subject_id: '' }, 'en', t);
    expect(vm.displayTitle).toBe('intro');
  });

  it('computes progressPercent from mastery when all_concept > 0', () => {
    const vm = toDashboardSubject(baseJob, 'en', t);
    expect(vm.metrics.progressPercent).toBe(50); // 4/8 * 100
  });

  it('uses continueLearning cta when progress > 0', () => {
    const vm = toDashboardSubject(baseJob, 'en', t);
    expect(vm.ctaLabel).toBe('continueLearning');
  });

  it('uses startLearning cta when progress is 0', () => {
    const vm = toDashboardSubject(
      { ...baseJob, mastered_concept: 0, all_concept: 0, progress_percent: 0 },
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
