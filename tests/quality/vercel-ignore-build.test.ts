import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { decideBuild, fetchLabels } from '../../scripts/vercel-ignore-build.mjs';

type Labels = string[] | null;
const decide = (o: {
  vercelEnv?: string;
  branch?: string;
  pullRequestId?: string;
  labels?: Labels;
}) => decideBuild({ vercelEnv: 'preview', branch: 'eng/RIN-1', labels: null, ...o });

describe('vercel-ignore-build decision (RIN-1153)', () => {
  it('always builds production', () => {
    expect(decide({ vercelEnv: 'production', branch: 'dependabot/npm/x' }).build).toBe(true);
  });
  it('skips dependabot previews', () => {
    expect(
      decide({ branch: 'dependabot/npm/x', pullRequestId: '5', labels: ['type:ui'] }).build,
    ).toBe(false);
  });
  it('skips a branch push with no PR', () => {
    expect(decide({ pullRequestId: '' }).build).toBe(false);
  });
  it('builds a PR labelled type:ui', () => {
    expect(decide({ pullRequestId: '7', labels: ['type:infra', 'type:ui'] }).build).toBe(true);
  });
  it('skips a PR without type:ui', () => {
    expect(decide({ pullRequestId: '7', labels: ['type:infra'] }).build).toBe(false);
    expect(decide({ pullRequestId: '7', labels: [] }).build).toBe(false);
  });
  it('fails open when labels are unavailable', () => {
    expect(decide({ pullRequestId: '7', labels: null }).build).toBe(true);
  });
});

describe('vercel-ignore-build fetchLabels', () => {
  it('returns null without a token and never calls the API', async () => {
    const fetchImpl = vi.fn();
    expect(await fetchLabels('7', undefined, fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('maps label names on success', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [{ name: 'type:ui' }] });
    expect(await fetchLabels('7', 'tok', fetchImpl)).toEqual(['type:ui']);
  });
  it('returns null on HTTP error, bad body and network error', async () => {
    expect(await fetchLabels('7', 't', vi.fn().mockResolvedValue({ ok: false }))).toBeNull();
    expect(
      await fetchLabels('7', 't', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })),
    ).toBeNull();
    expect(await fetchLabels('7', 't', vi.fn().mockRejectedValue(new Error('timeout')))).toBeNull();
  });
});

describe('vercel.json', () => {
  it('wires the ignore command', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as { ignoreCommand?: string };
    expect(config.ignoreCommand).toBe('node scripts/vercel-ignore-build.mjs');
  });
});
