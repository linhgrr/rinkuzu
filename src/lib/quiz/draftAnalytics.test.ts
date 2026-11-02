// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizDraft } from '@/features/quiz/types/quiz-draft';

// The analytics client reads the GA id at import; its dataLayer is the observable sink.
vi.hoisted(() => {
  process.env['NEXT_PUBLIC_GA_ID'] = 'G-TEST123';
});

import { reportQuizDraftTerminal } from './draftAnalytics';

type Draft = Parameters<typeof reportQuizDraftTerminal>[0];

function draft(overrides: Partial<QuizDraft> = {}): Draft {
  return {
    id: 'draft-1',
    status: 'processing',
    error: null,
    createdAt: '2026-11-02T10:00:00.000Z',
    updatedAt: '2026-11-02T10:00:30.000Z',
    ...overrides,
  };
}

function analyticsEvents(name: string) {
  return (window.dataLayer ?? []).filter(
    (entry) => Array.isArray(entry) && entry[0] === 'event' && entry[1] === name,
  ) as [string, string, Record<string, unknown>][];
}

describe('reportQuizDraftTerminal', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('rinkuzu_analytics_consent_v1', 'granted');
    window.dataLayer = [];
  });

  it('emits one pipeline_completed when the draft becomes ready, however often it is polled', () => {
    reportQuizDraftTerminal(draft({ status: 'processing' }));
    reportQuizDraftTerminal(draft({ status: 'completed' }));
    reportQuizDraftTerminal(draft({ status: 'completed' }));

    const completed = analyticsEvents('pipeline_completed');
    expect(completed).toHaveLength(1);
    expect(completed[0]?.[2]).toMatchObject({ path: 'quiz_draft', duration_ms: 30_000 });
    expect(completed[0]?.[2]).not.toHaveProperty('error_code');
  });

  it.each([
    ['failed', 'OCR API request failed for all configured keys.', 'ocr_failed'],
    ['failed', 'LLM call timed out', 'timeout'],
    ['failed', 'Lecture 3 - Nguyen.pdf could not be parsed', 'draft_failed'],
    ['failed', null, 'draft_failed'],
    ['cancelled', null, 'draft_cancelled'],
    ['expired', null, 'draft_expired'],
  ] as const)('emits pipeline_failed for %s (%s) as %s without raw text', (status, error, code) => {
    reportQuizDraftTerminal(draft({ status, error }));
    reportQuizDraftTerminal(draft({ status, error }));

    const failed = analyticsEvents('pipeline_failed');
    expect(failed).toHaveLength(1);
    expect(failed[0]?.[2]).toMatchObject({ path: 'quiz_draft', error_code: code });
    expect(JSON.stringify(failed[0]?.[2])).not.toMatch(/OCR API|Lecture|LLM/);
  });

  it.each(['drafting', 'queued', 'processing', 'submitted'] as const)(
    'ignores the non-terminal status %s',
    (status) => {
      reportQuizDraftTerminal(draft({ status }));

      expect(analyticsEvents('pipeline_completed')).toHaveLength(0);
      expect(analyticsEvents('pipeline_failed')).toHaveLength(0);
    },
  );
});
