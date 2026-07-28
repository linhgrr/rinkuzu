import { describe, expect, it } from 'vitest';
import { evaluateCodeqlSarif } from '../../scripts/check-codeql-sarif.mjs';

function sarif(
  resultOverrides: Record<string, unknown>,
  ruleOverrides: Record<string, unknown> = {},
) {
  return {
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            rules: [
              {
                id: 'js/example',
                defaultConfiguration: { level: 'warning' },
                properties: {},
                ...ruleOverrides,
              },
            ],
          },
        },
        results: [
          {
            ruleId: 'js/example',
            ruleIndex: 0,
            message: { text: 'Example finding' },
            ...resultOverrides,
          },
        ],
      },
    ],
  };
}

describe('CodeQL SARIF gate', () => {
  it('allows informational and non-high quality findings', () => {
    expect(evaluateCodeqlSarif(sarif({ level: 'warning' }))).toEqual({
      resultCount: 1,
      findings: [],
    });
  });

  it('fails on error-level findings', () => {
    expect(evaluateCodeqlSarif(sarif({ level: 'error' })).findings).toEqual([
      expect.objectContaining({ ruleId: 'js/example', level: 'error' }),
    ]);
  });

  it('fails on high security severity even when SARIF level is warning', () => {
    expect(
      evaluateCodeqlSarif(
        sarif({ level: 'warning' }, { properties: { 'security-severity': '8.1' } }),
      ).findings,
    ).toEqual([
      expect.objectContaining({
        ruleId: 'js/example',
        level: 'warning',
        securitySeverity: 8.1,
      }),
    ]);
  });

  it('fails closed on malformed SARIF', () => {
    expect(() => evaluateCodeqlSarif({ version: '2.1.0' })).toThrow(/with runs/);
  });
});
