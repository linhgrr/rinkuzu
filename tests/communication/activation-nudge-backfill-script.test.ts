import { describe, expect, it } from 'vitest';

import {
  formatBackfillReport,
  readBackfillOptions,
} from '../../scripts/activation-nudge-backfill.mjs';

const OBJECT_ID = /\b[0-9a-f]{24}\b/i;

describe('activation-nudge backfill script', () => {
  it('defaults to a dry run', () => {
    expect(readBackfillOptions([]).mode).toBe('dry-run');
    expect(readBackfillOptions(['--apply']).mode).toBe('apply');
    expect(() => readBackfillOptions(['--apply', '--dry-run'])).toThrow();
  });

  it('prints counts only, never an address, name or id', () => {
    const output = formatBackfillReport({
      mode: 'dry-run',
      lookbackDays: 90,
      signups: 40,
      eligible: 17,
      enqueued: 0,
      excluded: {
        activated: 12,
        excluded_account: 5,
        unsubscribed: 1,
        already_nudged: 3,
        too_early: 2,
        sample: 'learner@mail.fixture-rinkuzu.vn',
      },
      adaptiveChecked: true,
      firstSendAt: '2026-11-07T12:00:00.000Z',
      lastSendAt: '2026-11-07T12:08:00.000Z',
      learners: [{ id: '6a8ed209f04328ac17443d91', email: 'learner@mail.fixture-rinkuzu.vn' }],
      name: 'Fixture Learner',
    });

    expect(output).not.toContain('@');
    expect(output).not.toMatch(OBJECT_ID);
    expect(output).not.toContain('Fixture');
    expect(output).toContain('eligible: 17');
    expect(output).toContain('excluded.activated: 12');
    expect(output).toContain('excluded.too_early: 2');
  });
});
