import { describe, expect, it } from 'vitest';
import {
  FollowUp,
  isInboxExhausted,
  isStalled,
  manualActivationFollowUp,
  reconciliationDelayMs,
  retryFollowUp,
  terminalWatchFollowUp,
  withJitter,
} from './schedule';

const NOW = Date.UTC(2026, 6, 1, 12, 0, 0);

// The policy numbers are stated here rather than imported: these tests exist to
// pin the values a change would silently move, and importing the constant would
// make the assertion agree with any edit to it.
const INBOX_MAX_ATTEMPTS = 50;
const INBOX_MAX_AGE_MS = 7 * 86_400_000;
const ATTEMPT_STALL_MS = 24 * 3_600_000;
const TERMINAL_WATCH_HORIZON_MS = 7 * 86_400_000;

describe('FollowUp', () => {
  it('refuses a schedule that is not strictly in the future', () => {
    for (const delay of [0, -1, -60_000]) {
      expect(() => FollowUp.in(NOW, delay)).toThrowError(
        expect.objectContaining({ code: 'invalid_schedule' }),
      );
    }
  });

  it('refuses a non-integer clock or delay', () => {
    expect(() => FollowUp.in(Number.NaN, 1_000)).toThrowError();
    expect(() => FollowUp.in(NOW, 1.5)).toThrowError();
  });

  it('carries both the due time and the delay that produced it', () => {
    const followUp = FollowUp.in(NOW, 30_000);
    expect(followUp.atMs).toBe(NOW + 30_000);
    expect(followUp.delayMs).toBe(30_000);
  });
});

describe('reconciliationDelayMs', () => {
  it('climbs monotonically with the age of the work item', () => {
    const ages = [0, 60_000, 15 * 60_000, 45 * 60_000, 2 * 3_600_000, 3 * 86_400_000];
    const delays = ages.map(reconciliationDelayMs);
    for (let index = 1; index < delays.length; index += 1) {
      expect(delays[index]).toBeGreaterThanOrEqual(delays[index - 1] as number);
    }
    expect(delays[0]).toBe(60_000);
    expect(delays.at(-1)).toBe(6 * 3_600_000);
  });
});

describe('withJitter', () => {
  it('stays within +/-20% of the base and never drops below a second', () => {
    for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
      const jittered = withJitter(60_000, () => roll);
      expect(jittered).toBeGreaterThanOrEqual(48_000);
      expect(jittered).toBeLessThanOrEqual(72_000);
    }
    expect(withJitter(10, () => 0)).toBe(1_000);
  });
});

describe('retryFollowUp', () => {
  it('always schedules strictly into the future for any roll and any age', () => {
    for (const roll of [0, 0.5, 1]) {
      for (const ageMs of [0, 20 * 60_000, 5 * 3_600_000, 10 * 86_400_000]) {
        const followUp = retryFollowUp({
          nowMs: NOW,
          startedAtMs: NOW - ageMs,
          random: () => roll,
        });
        expect(followUp.atMs).toBeGreaterThan(NOW);
      }
    }
  });
});

describe('terminalWatchFollowUp', () => {
  it('keeps watching a freshly settled attempt for late money', () => {
    const followUp = terminalWatchFollowUp({
      nowMs: NOW,
      settledAtMs: NOW - 3_600_000,
      random: () => 0.5,
    });
    expect(followUp?.atMs).toBeGreaterThan(NOW);
  });

  it('stops watching once the horizon has passed so the queue drains', () => {
    expect(
      terminalWatchFollowUp({
        nowMs: NOW,
        settledAtMs: NOW - TERMINAL_WATCH_HORIZON_MS,
        random: () => 0.5,
      }),
    ).toBeNull();
  });
});

describe('isInboxExhausted', () => {
  it('dead-letters on attempts or age, whichever comes first', () => {
    expect(
      isInboxExhausted({ nowMs: NOW, createdAtMs: NOW, attemptCount: INBOX_MAX_ATTEMPTS }),
    ).toBe(true);
    expect(
      isInboxExhausted({ nowMs: NOW, createdAtMs: NOW - INBOX_MAX_AGE_MS, attemptCount: 1 }),
    ).toBe(true);
    expect(isInboxExhausted({ nowMs: NOW, createdAtMs: NOW - 60_000, attemptCount: 1 })).toBe(
      false,
    );
  });
});

describe('isStalled', () => {
  it('marks an attempt stalled only after the stall window', () => {
    expect(isStalled({ nowMs: NOW, startedAtMs: NOW - ATTEMPT_STALL_MS })).toBe(true);
    expect(isStalled({ nowMs: NOW, startedAtMs: NOW - ATTEMPT_STALL_MS + 1 })).toBe(false);
  });
});

describe('manualActivationFollowUp', () => {
  it('parks the order well into the future instead of leaving it hot', () => {
    const followUp = manualActivationFollowUp(NOW, () => 0);
    expect(followUp.atMs - NOW).toBeGreaterThan(30 * 60_000);
  });
});
