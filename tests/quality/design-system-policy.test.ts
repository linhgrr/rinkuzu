import { describe, expect, it } from 'vitest';
import { evaluateDesignSystem } from '../../scripts/check-design-system.mjs';

function policy(overrides: Record<string, unknown> = {}) {
  return {
    baseline: {
      'consumer-hardcoded-color': 0,
      'arbitrary-typography': 0,
      'arbitrary-radius-shadow': 0,
      'arbitrary-layout-spacing': 0,
      'raw-neutral-border': 0,
      'standalone-raw-button': 0,
      'raw-select': 0,
      'solid-orange-dark-text': 0,
      'new-icon-family': 0,
    },
    allowedIconFamilies: ['react-icons/hi'],
    ruleExclusions: {},
    exceptions: [],
    ...overrides,
  };
}

describe('design-system ratchet', () => {
  it('rejects a new consumer violation over baseline', () => {
    const result = evaluateDesignSystem(
      [{ path: 'src/example.tsx', content: '<div className="text-[#123456]" />' }],
      policy(),
    );

    expect(result.errors).toContainEqual(expect.stringContaining('consumer-hardcoded-color'));
  });

  it('rejects debt that grows beyond a non-zero baseline', () => {
    const result = evaluateDesignSystem(
      [{ path: 'src/example.tsx', content: '<div className="rounded-[13px] shadow-[1px_1px]" />' }],
      policy({ baseline: { 'arbitrary-radius-shadow': 1 } }),
    );

    expect(result.counts['arbitrary-radius-shadow']).toBe(2);
    expect(result.errors).toContainEqual(expect.stringContaining('increased from 1 to 2'));
  });

  it('rejects dark text on a solid orange action surface', () => {
    const result = evaluateDesignSystem(
      [
        {
          path: 'src/example.tsx',
          content: '<button className="bg-brand-action px-4 text-neutral-900">Save</button>',
        },
      ],
      policy(),
    );

    expect(result.errors).toContainEqual(expect.stringContaining('solid-orange-dark-text'));
  });

  it('rejects expired and unused exceptions', () => {
    const common = {
      path: 'src/example.tsx',
      ruleId: 'arbitrary-layout-spacing',
      value: '*',
      maxOccurrences: 1,
      kind: 'temporary',
      rationale: 'Fixture',
      owner: 'test',
    };
    const expired = evaluateDesignSystem(
      [{ path: 'src/example.tsx', content: '<div className="w-[13px]" />' }],
      policy({ exceptions: [{ ...common, expiresAt: '2025-01-01' }] }),
      { now: new Date('2026-07-28') },
    );
    const unused = evaluateDesignSystem(
      [{ path: 'src/example.tsx', content: '<div />' }],
      policy({ exceptions: [common] }),
    );

    expect(expired.errors).toContainEqual(expect.stringContaining('Expired exception'));
    expect(unused.errors).toContainEqual(expect.stringContaining('Unused exception'));
  });

  it('allows a bounded optical geometry exception', () => {
    const result = evaluateDesignSystem(
      [
        {
          path: 'src/features/dashboard/Hero.tsx',
          content: '<div className="absolute h-[58.977px] rotate-[3.7deg]" />',
        },
      ],
      policy({
        exceptions: [
          {
            path: 'src/features/dashboard/*.tsx',
            ruleId: 'arbitrary-layout-spacing',
            value: '*',
            maxOccurrences: 1,
            kind: 'optical',
            rationale: 'Preserve artwork crop',
            owner: 'design-system',
          },
        ],
      }),
    );

    expect(result.counts['arbitrary-layout-spacing']).toBe(0);
    expect(result.errors).toEqual([]);
  });
});
