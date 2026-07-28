import { describe, expect, it } from 'vitest';
import {
  canonicalAuditValue,
  fingerprintAuditFinding,
} from '../../scripts/npm-audit-fingerprint.mjs';

describe('npm audit finding fingerprints', () => {
  it('canonicalizes object keys and set-like arrays deterministically', () => {
    const left = {
      via: [{ url: 'https://example.test/2', source: 2 }, 'package-a'],
      nodes: ['node_modules/z', 'node_modules/a'],
    };
    const right = {
      nodes: ['node_modules/a', 'node_modules/z'],
      via: ['package-a', { source: 2, url: 'https://example.test/2' }],
    };

    expect(canonicalAuditValue(left)).toEqual(canonicalAuditValue(right));
  });

  it('produces the same fingerprint when npm returns arrays in a different order', () => {
    const finding = {
      severity: 'high',
      isDirect: false,
      range: '<1.2.3',
      via: [{ source: 123, name: 'advisory' }, 'transitive-package'],
      effects: ['consumer-b', 'consumer-a'],
      nodes: ['node_modules/z', 'node_modules/a'],
      fixAvailable: false,
    };
    const reordered = {
      ...finding,
      via: [...finding.via].reverse(),
      effects: [...finding.effects].reverse(),
      nodes: [...finding.nodes].reverse(),
    };

    expect(fingerprintAuditFinding('example', finding)).toBe(
      fingerprintAuditFinding('example', reordered),
    );
  });

  it('changes the fingerprint when material evidence changes', () => {
    const finding = {
      severity: 'high',
      isDirect: false,
      range: '<1.2.3',
      via: ['transitive-package'],
      effects: [],
      nodes: ['node_modules/example'],
      fixAvailable: false,
    };

    expect(fingerprintAuditFinding('example', finding)).not.toBe(
      fingerprintAuditFinding('example', { ...finding, range: '<2.0.0' }),
    );
  });

  it('ignores npm remediation suggestions and reverse dependency ordering', () => {
    const finding = {
      severity: 'high',
      isDirect: false,
      range: '<1.2.3',
      via: ['transitive-package'],
      effects: ['consumer-a'],
      nodes: ['node_modules/example'],
      fixAvailable: false,
    };

    expect(fingerprintAuditFinding('example', finding)).toBe(
      fingerprintAuditFinding('example', {
        ...finding,
        effects: ['consumer-b', 'consumer-a'],
        fixAvailable: { name: 'example', version: '99.0.0', isSemVerMajor: true },
      }),
    );
  });
});
