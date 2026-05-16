import { describe, expect, it } from 'vitest';

import { constantTimeEqual, createSecureToken, hashToken } from '@/lib/auth-tokens';

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

describe('constantTimeEqual', () => {
  it('compares equal strings', () => {
    expect(constantTimeEqual('hello', 'hello')).toBe(true);
  });

  it('rejects different lengths without crashing', () => {
    expect(constantTimeEqual('a', 'aa')).toBe(false);
  });

  it('rejects mismatched same-length strings', () => {
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
  });

  it('rejects non-string input', () => {
    // @ts-expect-error testing runtime behavior
    expect(constantTimeEqual(null, 'a')).toBe(false);
    // @ts-expect-error testing runtime behavior
    expect(constantTimeEqual('a', undefined)).toBe(false);
  });
});
