// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PipelineJobListItem } from '@/features/adaptive/types/pipeline';

// The analytics client reads the GA id at import; its dataLayer is the observable sink.
vi.hoisted(() => {
  process.env['NEXT_PUBLIC_GA_ID'] = 'G-TEST123';
});

import { reportAdaptivePipelineTerminals, trackAdaptivePipelineJob } from './pipeline-analytics';

type Job = Parameters<typeof reportAdaptivePipelineTerminals>[0][number];

function job(overrides: Partial<PipelineJobListItem> = {}): Job {
  return {
    job_id: 'job-1',
    status: 'extracting',
    error_code: null,
    retry_count: 0,
    created_at: 100,
    updated_at: 160,
    ...overrides,
  };
}

function analyticsEvents(name: string) {
  return (window.dataLayer ?? []).filter(
    (entry) => Array.isArray(entry) && entry[0] === 'event' && entry[1] === name,
  ) as [string, string, Record<string, unknown>][];
}

describe('adaptive pipeline terminal analytics', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('rinkuzu_analytics_consent_v1', 'granted');
    window.dataLayer = [];
  });

  it('reports a tracked job once, on the poll where it turns terminal', () => {
    trackAdaptivePipelineJob('job-1', 'journey-1');

    reportAdaptivePipelineTerminals([job({ status: 'embedding' })]);
    expect(analyticsEvents('pipeline_completed')).toHaveLength(0);

    reportAdaptivePipelineTerminals([job({ status: 'completed' })]);
    reportAdaptivePipelineTerminals([job({ status: 'completed' })]);

    const completed = analyticsEvents('pipeline_completed');
    expect(completed).toHaveLength(1);
    expect(completed[0]?.[2]).toMatchObject({
      path: 'adaptive',
      journey_id: 'journey-1',
      duration_ms: 60_000,
    });
  });

  it('reports failures with a slug error code and cancellations as pipeline_cancelled', () => {
    trackAdaptivePipelineJob('job-1', 'journey-1');
    trackAdaptivePipelineJob('job-2', 'journey-2');
    trackAdaptivePipelineJob('job-3', 'journey-3');

    reportAdaptivePipelineTerminals([
      job({ status: 'failed', error_code: 'pipeline_timeout' }),
      job({ job_id: 'job-2', status: 'cancelled' }),
      job({ job_id: 'job-3', status: 'failed', error_code: 'OCR API request failed.' }),
    ]);

    expect(analyticsEvents('pipeline_failed').map(([, , props]) => props['error_code'])).toEqual([
      'pipeline_timeout',
      'pipeline_cancelled',
      'unknown',
    ]);
  });

  it('reports a retried job again for its new attempt', () => {
    trackAdaptivePipelineJob('job-1', 'journey-1');

    reportAdaptivePipelineTerminals([job({ status: 'failed', error_code: 'ocr_failed' })]);
    reportAdaptivePipelineTerminals([job({ status: 'completed', retry_count: 1 })]);

    expect(analyticsEvents('pipeline_failed')).toHaveLength(1);
    expect(analyticsEvents('pipeline_completed')).toHaveLength(1);
  });

  it('ignores jobs this browser did not submit', () => {
    reportAdaptivePipelineTerminals([job({ status: 'completed' })]);

    expect(analyticsEvents('pipeline_completed')).toHaveLength(0);
  });

  it('does not track jobs without analytics consent', () => {
    window.localStorage.setItem('rinkuzu_analytics_consent_v1', 'denied');
    trackAdaptivePipelineJob('job-1', 'journey-1');

    expect(window.localStorage.getItem('rinkuzu_analytics_adaptive_jobs_v1')).toBeNull();
  });
});
