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
      fingerprintAuditFinding('example', { ...finding, severity: 'critical' }),
    );
    expect(fingerprintAuditFinding('example', finding)).not.toBe(
      fingerprintAuditFinding('example', { ...finding, via: ['other-package'] }),
    );
    expect(fingerprintAuditFinding('example', finding)).not.toBe(
      fingerprintAuditFinding('example', {
        ...finding,
        nodes: ['node_modules/a/node_modules/example'],
      }),
    );
  });

  // RIN-880: npm derives the top-level `range` of a transitive-only finding from the
  // registry's version list, so it moves whenever the publisher ships a new (canary)
  // version or the npm cache is fresher. Same lockfile, different range.
  it('ignores the registry-derived top-level range', () => {
    const finding = {
      severity: 'high',
      isDirect: false,
      range: '<=1.0.3',
      via: ['zod'],
      effects: [],
      nodes: ['node_modules/@ag-ui/client'],
      fixAvailable: false,
    };

    expect(fingerprintAuditFinding('@ag-ui/client', finding)).toBe(
      fingerprintAuditFinding('@ag-ui/client', {
        ...finding,
        range: '<=1.0.4-canary.1792171324.0',
      }),
    );
  });

  it('still changes the fingerprint when a direct advisory id or its vulnerable range changes', () => {
    const advisory = {
      source: 1_000_001,
      name: 'zod',
      dependency: 'zod',
      title: 'Example advisory',
      url: 'https://github.com/advisories/GHSA-xxxx-xxxx-xxxx',
      severity: 'high',
      cwe: ['CWE-400'],
      cvss: { score: 7.5, vectorString: null },
      range: '<3.25.77',
    };
    const finding = {
      severity: 'high',
      isDirect: false,
      range: '<3.25.77',
      via: [advisory],
      effects: [],
      nodes: ['node_modules/zod'],
      fixAvailable: false,
    };
    const base = fingerprintAuditFinding('zod', finding);

    expect(base).not.toBe(
      fingerprintAuditFinding('zod', {
        ...finding,
        via: [{ ...advisory, source: 1_000_002, url: 'https://github.com/advisories/GHSA-yyyy' }],
      }),
    );
    expect(base).not.toBe(
      fingerprintAuditFinding('zod', { ...finding, via: [{ ...advisory, range: '<4.0.0' }] }),
    );
    expect(base).not.toBe(
      fingerprintAuditFinding('zod', { ...finding, via: [advisory, 'other-package'] }),
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
