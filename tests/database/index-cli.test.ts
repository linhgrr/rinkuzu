import { describe, expect, it } from 'vitest';

import {
  isIndexApplyMode,
  parseIndexCliArgs,
  readModeExitCode,
  selectIndexActionsForMode,
  validatePartialApplyRemainder,
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
    expect(() => parseIndexCliArgs(['--apply-safe-only', '--plan-sha', 'short'])).toThrow(
      /SHA-256/,
    );
  });

  it('parses safe-only apply as a write mode with an exact plan SHA', () => {
    const sha = 'c'.repeat(64);
    expect(parseIndexCliArgs(['--apply-safe-only', `--plan-sha=${sha}`])).toMatchObject({
      mode: 'apply-safe-only',
      planSha: sha,
    });
    expect(isIndexApplyMode('apply-safe-only')).toBe(true);
    expect(() => readModeExitCode('apply-safe-only', { blockingCount: 0 })).toThrow(
      /not read-only/,
    );
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
      actionTypes: null,
    });
  });

  it('restricts action-type filters to partial apply modes', () => {
    const sha = 'd'.repeat(64);
    expect(
      parseIndexCliArgs(['--apply-safe-only', `--plan-sha=${sha}`, '--action-types=create,hide']),
    ).toMatchObject({ actionTypes: ['create', 'hide'] });
    expect(() => parseIndexCliArgs(['--plan', '--action-types=create'])).toThrow(
      /only with --apply-safe-only or --apply-selected/,
    );
    expect(() => parseIndexCliArgs(['--apply-safe-only', '--action-types=unknown'])).toThrow(
      /Unsupported index action type/,
    );
  });

  it('requires an explicit action allowlist for selected apply mode', () => {
    const sha = 'e'.repeat(64);
    expect(
      parseIndexCliArgs(['--apply-selected', `--plan-sha=${sha}`, '--action-types=create']),
    ).toMatchObject({
      mode: 'apply-selected',
      planSha: sha,
      actionTypes: ['create'],
    });
    expect(isIndexApplyMode('apply-selected')).toBe(true);
    expect(() => parseIndexCliArgs(['--apply-selected', `--plan-sha=${sha}`])).toThrow(
      /requires --action-types/,
    );
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

  it('applies only ordinary actions and keeps the exact sensitive remainder red', () => {
    const sourcePlan = {
      actions: [
        { fingerprint: 'safe', sensitive: false },
        { fingerprint: 'sensitive', sensitive: true },
      ],
    };
    const verificationPlan = {
      actions: [{ fingerprint: 'sensitive', sensitive: true }],
      manualCount: 0,
    };

    const selected = selectIndexActionsForMode(sourcePlan, 'apply-safe-only');
    expect(selected).toEqual([{ fingerprint: 'safe', sensitive: false }]);
    expect(
      validatePartialApplyRemainder({
        sourcePlan,
        verificationPlan,
        selectedFingerprints: selected.map((action: { fingerprint: string }) => action.fingerprint),
      }),
    ).toEqual([]);
    expect(
      validatePartialApplyRemainder({
        sourcePlan,
        verificationPlan: {
          actions: [{ fingerprint: 'unexpected', sensitive: false }],
          manualCount: 0,
        },
        selectedFingerprints: ['safe'],
      }),
    ).toEqual(['Post-apply drift does not exactly match the unselected source actions']);
  });

  it('keeps safe actions outside an explicit type allowlist in the verified remainder', () => {
    const sourcePlan = {
      actions: [
        { fingerprint: 'create', sensitive: false, type: 'create' },
        { fingerprint: 'hide', sensitive: false, type: 'hide' },
        { fingerprint: 'ttl', sensitive: true, type: 'update_ttl' },
      ],
    };
    const selected = selectIndexActionsForMode(sourcePlan, 'apply-safe-only', ['create']);

    expect(selected.map((action: { fingerprint: string }) => action.fingerprint)).toEqual([
      'create',
    ]);
    expect(
      validatePartialApplyRemainder({
        sourcePlan,
        verificationPlan: {
          actions: [sourcePlan.actions[1], sourcePlan.actions[2]],
          manualCount: 0,
        },
        selectedFingerprints: ['create'],
      }),
    ).toEqual([]);
  });

  it('applies an explicitly selected sensitive action with exact subset approval', () => {
    const sourcePlan = {
      planSha: 'f'.repeat(64),
      actions: [
        { fingerprint: 'ttl', sensitive: true, type: 'update_ttl' },
        { fingerprint: 'unique-create', sensitive: true, type: 'create' },
        { fingerprint: 'hide', sensitive: false, type: 'hide' },
      ],
    };
    const selected = selectIndexActionsForMode(sourcePlan, 'apply-selected', ['create']);
    const approvalPlan = { ...sourcePlan, actions: selected };
    const approval = {
      planSha: sourcePlan.planSha,
      approvedBy: 'database-owner',
      approvedAt: '2026-07-15T00:00:00.000Z',
      ticket: 'DB-43',
      actions: ['unique-create'],
    };

    expect(selected).toEqual([sourcePlan.actions[1]]);
    expect(
      validateSensitiveApproval({
        approval,
        plan: approvalPlan,
        now: new Date('2026-07-16T00:00:00.000Z'),
      }),
    ).toEqual([]);
    expect(
      validatePartialApplyRemainder({
        sourcePlan,
        verificationPlan: {
          actions: [sourcePlan.actions[0], sourcePlan.actions[2]],
          manualCount: 0,
        },
        selectedFingerprints: ['unique-create'],
      }),
    ).toEqual([]);
    expect(() => selectIndexActionsForMode(sourcePlan, 'apply-selected', ['drop'])).toThrow(
      /No current index actions match/,
    );
  });
});
