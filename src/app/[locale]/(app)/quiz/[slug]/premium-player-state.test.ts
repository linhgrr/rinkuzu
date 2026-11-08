import { describe, expect, it } from 'vitest';
import type { PremiumBatchViewModel } from '@/features/quiz/api/premium-quiz-api';
import {
  initialPremiumPlayerState,
  premiumPlayerReducer,
  type PremiumPlayerAction,
  type PremiumPlayerState,
} from './premium-player-state';

function batch(overrides: Partial<PremiumBatchViewModel> = {}): PremiumBatchViewModel {
  return {
    sessionId: 'session-1',
    quizId: 'quiz-1',
    submissionId: 'submission-1',
    title: 'Fake premium quiz',
    totalQuestions: 6,
    batchIndex: 0,
    startIndex: 0,
    questions: [],
    nextCursor: 'cursor-1',
    watermark: 'learner-1',
    idleExpiresAt: '2026-11-08T01:00:00.000Z',
    absoluteExpiresAt: '2026-11-08T03:00:00.000Z',
    currentQuestionIndex: 1,
    answers: [0, null, null],
    ...overrides,
  };
}

function run(actions: PremiumPlayerAction[], from = initialPremiumPlayerState): PremiumPlayerState {
  return actions.reduce(premiumPlayerReducer, from);
}

describe('premiumPlayerReducer (RIN-1193)', () => {
  it('starts loading with no session', () => {
    expect(initialPremiumPlayerState).toMatchObject({ loading: true, sessionId: '', error: '' });
  });

  it('loads a started session and clears earlier failures', () => {
    const state = run([
      { type: 'startFailed', kind: 'unlock_required', error: new Error('locked') },
      { type: 'actionFailed', message: 'Không mở khoá được' },
      { type: 'sessionStarted', batch: batch() },
      { type: 'settled' },
    ]);
    expect(state).toMatchObject({
      batches: { 0: batch() },
      currentIndex: 1,
      answers: [0, null, null],
      sessionId: 'session-1',
      watermark: 'learner-1',
      unlockRequired: false,
      error: '',
      loading: false,
    });
  });

  it('routes a failed start by kind and ignores an aborted one', () => {
    const error = new Error('boom');
    expect(run([{ type: 'startFailed', kind: 'auth_required', error }])).toMatchObject({
      signInRequired: true,
      loadError: null,
    });
    expect(run([{ type: 'startFailed', kind: 'unlock_required', error }])).toMatchObject({
      unlockRequired: true,
      loadError: null,
    });
    expect(run([{ type: 'startFailed', kind: 'server', error }]).loadError).toBe(error);
    expect(run([{ type: 'startFailed', kind: 'aborted', error }])).toBe(initialPremiumPlayerState);
  });

  it('clears the page error and inline copy when a start is retried', () => {
    const failed = run([
      { type: 'startFailed', kind: 'server', error: new Error('boom') },
      { type: 'actionFailed', message: 'Lỗi' },
      { type: 'settled' },
    ]);
    expect(run([{ type: 'startRequested' }], failed)).toMatchObject({
      loading: true,
      loadError: null,
      error: '',
    });
  });

  it('keeps the inline error on submit but clears it on unlock', () => {
    const failed = run([{ type: 'actionFailed', message: 'Lỗi' }, { type: 'settled' }]);
    expect(run([{ type: 'actionRequested', clearError: false }], failed)).toMatchObject({
      loading: true,
      error: 'Lỗi',
    });
    expect(run([{ type: 'actionRequested', clearError: true }], failed)).toMatchObject({
      loading: true,
      error: '',
    });
  });

  it('records answers by index without mutating the previous list', () => {
    const started = run([{ type: 'sessionStarted', batch: batch() }]);
    const answered = run([{ type: 'answerChosen', index: 2, answer: [1, 3] }], started);
    expect(answered.answers).toEqual([0, null, [1, 3]]);
    expect(started.answers).toEqual([0, null, null]);
  });

  it('adds a prefetched batch beside the loaded ones and takes its watermark', () => {
    const next = batch({ batchIndex: 1, startIndex: 3, watermark: 'learner-1:b1' });
    const state = run([
      { type: 'sessionStarted', batch: batch() },
      { type: 'batchLoaded', batch: next },
      { type: 'moved', index: 3 },
    ]);
    expect(Object.keys(state.batches)).toEqual(['0', '1']);
    expect(state).toMatchObject({ watermark: 'learner-1:b1', currentIndex: 3 });
  });

  it('asks to sign in again without dropping the session', () => {
    const state = run([{ type: 'sessionStarted', batch: batch() }, { type: 'signInRequired' }]);
    expect(state).toMatchObject({ signInRequired: true, sessionId: 'session-1' });
  });
});
