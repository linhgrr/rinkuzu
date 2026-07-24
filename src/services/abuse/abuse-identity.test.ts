import { describe, expect, it } from 'vitest';
import {
  activeRiskScore,
  hashSignalAcrossKeys,
  issueDeviceCookie,
  normalizeNetworkAddress,
  verifyDeviceCookie,
} from './abuse-identity';

describe('abuse identity', () => {
  it('rejects a client-forged device cookie', () => {
    expect(verifyDeviceCookie('v1.attacker.invalid', 'secret').valid).toBe(false);
  });

  it('round-trips a signed device cookie', () => {
    const cookie = issueDeviceCookie('secret');
    expect(verifyDeviceCookie(cookie, 'secret').valid).toBe(true);
  });

  it('queries identities across active key versions', () => {
    const hashes = hashSignalAcrossKeys('payer:bank:00123', [
      { version: 'k1', secret: 'old' },
      { version: 'k2', secret: 'new' },
    ]);
    expect(hashes.map((item) => item.keyVersion)).toEqual(['k1', 'k2']);
    expect(hashes[0]?.hash).not.toBe(hashes[1]?.hash);
  });

  it('normalizes IPv4-mapped IPv6', () => {
    expect(normalizeNetworkAddress('::ffff:127.0.0.1')).toBe('127.0.0.1');
  });

  it('scores active reasons once and lets expired reasons decay', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(
      activeRiskScore(
        [
          { weight: 40, validUntil: new Date('2026-01-02T00:00:00Z') },
          { weight: 80, validUntil: new Date('2025-12-31T00:00:00Z') },
        ],
        now,
      ),
    ).toBe(40);
  });
});
