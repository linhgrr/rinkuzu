import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';

import { createSecureToken, hashToken, wasIssuedRecently } from '@/lib/auth-tokens';

describe('createSecureToken / hashToken', () => {
  it('returns base64url raw + matching sha256 hash', () => {
    const { raw, hash } = createSecureToken();
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(raw)).toBe(hash);
  });

  it('produces a different token each call', () => {
    const a = createSecureToken();
    const b = createSecureToken();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });

  it('honors custom byte length', () => {
    const { raw } = createSecureToken(48);
    // base64url(48 bytes) = 64 chars
    expect(raw.length).toBe(64);
  });
});

describe('wasIssuedRecently', () => {
  const now = new Date('2026-07-17T12:00:00.000Z');
  const ttlMs = 24 * 60 * 60 * 1000;
  const minIntervalMs = 60 * 1000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fails closed for missing and expired timestamps', () => {
    expect(wasIssuedRecently(null, ttlMs, minIntervalMs)).toBe(false);
    expect(wasIssuedRecently(undefined, ttlMs, minIntervalMs)).toBe(false);
    expect(wasIssuedRecently(new Date(now.getTime() - 1), ttlMs, minIntervalMs)).toBe(false);
  });

  it('requires remaining lifetime to be strictly above the rotation threshold', () => {
    const threshold = ttlMs - minIntervalMs;
    expect(wasIssuedRecently(new Date(now.getTime() + threshold), ttlMs, minIntervalMs)).toBe(
      false,
    );
    expect(wasIssuedRecently(new Date(now.getTime() + threshold + 1), ttlMs, minIntervalMs)).toBe(
      true,
    );
  });
});
