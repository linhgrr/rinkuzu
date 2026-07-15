import { describe, expect, it } from 'vitest';

import {
  parseIndexCliArgs,
  readModeExitCode,
  validateSensitiveApproval,
} from '../../scripts/database/index-cli.mjs';

describe('database index CLI guardrails', () => {
  it('defaults to a non-failing plan and makes check/verify fail on drift', () => {
    const drift = { blockingCount: 1 };
    const clean = { blockingCount: 0 };

    expect(parseIndexCliArgs([]).mode).toBe('plan');
    expect(readModeExitCode('plan', drift)).toBe(0);
    expect(readModeExitCode('check', drift)).toBe(2);
    expect(readModeExitCode('verify', drift)).toBe(2);
    expect(readModeExitCode('check', clean)).toBe(0);
  });

  it('rejects conflicting modes, unknown flags, and malformed apply hashes', () => {
    expect(() => parseIndexCliArgs(['--plan', '--check'])).toThrow(/Conflicting modes/);
    expect(() => parseIndexCliArgs(['--unknown'])).toThrow(/Unknown argument/);
    expect(() => parseIndexCliArgs(['--apply', '--plan-sha', 'short'])).toThrow(/SHA-256/);
  });

  it('accepts environment-backed apply inputs and mandatory post verification', () => {
    const sha = 'a'.repeat(64);
    expect(
      parseIndexCliArgs(['--apply', '--verify'], {
        INDEX_PLAN_SHA: sha,
        INDEX_APPROVAL_FILE: '/tmp/approval.json',
      }),
    ).toEqual({
      mode: 'apply',
      planSha: sha,
      approvalFile: '/tmp/approval.json',
      verifyAfterApply: true,
    });
  });

  it('requires exact, current approval for every sensitive fingerprint', () => {
    const now = new Date('2026-07-15T00:00:00.000Z');
    const plan = {
      planSha: 'b'.repeat(64),
      actions: [
        { fingerprint: 'sensitive-b', sensitive: true },
        { fingerprint: 'ordinary', sensitive: false },
        { fingerprint: 'sensitive-a', sensitive: true },
      ],
    };
    const approval = {
      planSha: plan.planSha,
      approvedBy: 'database-owner',
      approvedAt: '2026-07-14T00:00:00.000Z',
      ticket: 'DB-42',
      actions: ['sensitive-a', 'sensitive-b'],
    };

    expect(validateSensitiveApproval({ approval, plan, now })).toEqual([]);
    expect(
      validateSensitiveApproval({
        approval: { ...approval, actions: ['sensitive-a'] },
        plan,
        now,
      }),
    ).toContain('Approval actions must exactly match every sensitive action fingerprint');
    expect(
      validateSensitiveApproval({
        approval: { ...approval, approvedAt: '2026-07-01T00:00:00.000Z' },
        plan,
        now,
      }),
    ).toContain('Approval is older than 7 days');
  });
});
