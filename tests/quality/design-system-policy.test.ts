import { describe, expect, it } from 'vitest';
import { evaluateDesignSystem } from '../../scripts/check-design-system.mjs';
import repoPolicy from '../../quality/design-system-policy.json';

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
      'solid-orange-white-text': 0,
      'new-icon-family': 0,
    },
    allowedIconFamilies: ['react-icons/hi'],
    ruleExclusions: {},
    exceptions: [],
    ...overrides,
  };
}

describe('design-system ratchet', () => {
  it('excludes independent visual systems from the app design-system ratchet', () => {
    const result = evaluateDesignSystem(
      [
        {
          path: 'src/features/landing/Hero.tsx',
          content: '<button className="border-gray-200 text-[#123456] w-[13px]">Go</button>',
        },
        {
          path: 'src/features/dashboard/Card.tsx',
          content: '<div className="border-gray-200" />',
        },
      ],
      policy({ excludedPaths: ['src/features/landing/**'] }),
    );

    expect(result.counts['consumer-hardcoded-color']).toBe(0);
    expect(result.counts['arbitrary-layout-spacing']).toBe(0);
    expect(result.counts['standalone-raw-button']).toBe(0);
    expect(result.counts['raw-neutral-border']).toBe(1);
    expect(result.errors).toContainEqual(expect.stringContaining('raw-neutral-border'));
  });

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

describe('solid-orange-white-text', () => {
  const landing = ['src/features/landing/**', 'src/features/auth/**'];
  const scan = (content: string, path = 'src/example.tsx') =>
    evaluateDesignSystem(
      [{ path, content }],
      policy({ excludedPaths: landing, scanExcludedPaths: ['solid-orange-white-text'] }),
    );

  it.each([
    'bg-[#ff541b] px-6 text-white',
    'text-white font-bold bg-[#FF541B]',
    'bg-[#fd761a] text-white',
    'bg-[var(--landing-nav-accent)] text-white',
    'bg-landing-action text-white',
    'bg-orange-500 text-white',
    'bg-orange-600 text-white/90',
    'bg-brand-action text-brand-action-text',
    'bg-accent text-brand-action-text',
    'bg-primary text-accent-text',
    'md:bg-brand-primary !text-white',
  ])('flags white text on a solid bright orange fill: %s', (classes) => {
    const result = scan(`<a className="${classes}">Go</a>`);

    expect(result.counts['solid-orange-white-text']).toBe(1);
    expect(result.errors).toContainEqual(expect.stringContaining('solid-orange-white-text'));
  });

  it.each([
    'bg-brand-action-strong text-white',
    'hover:bg-[#ff541b]/20 text-white',
    'hover:bg-[#ff541b] text-white',
    'bg-[#ff541b]/20 text-white',
    'border-[#ff541b] text-white',
    'bg-accent-soft text-white',
    'bg-brand-action text-ink',
    'bg-[#ff541b] hover:text-white',
    'bg-white text-[#ff541b]',
  ])('passes a contrast-safe pairing: %s', (classes) => {
    const result = scan(`<a className="${classes}">Go</a>`);

    expect(result.counts['solid-orange-white-text']).toBe(0);
  });

  it('does not pair classes across separate class strings', () => {
    const result = scan(
      '<section className="bg-[#ff541b]"><p className="text-white">Hi</p></section>',
    );

    expect(result.counts['solid-orange-white-text']).toBe(0);
  });

  it('scans landing and auth for this rule while other rules still skip them', () => {
    const result = scan(
      '<button className="bg-[#ff541b] w-[13px] border-gray-200 text-white">Sign up</button>',
      'src/features/landing/components/home/Hero.tsx',
    );

    expect(result.counts['solid-orange-white-text']).toBe(1);
    expect(result.errors).toContainEqual(
      expect.stringContaining('src/features/landing/components/home/Hero.tsx:1'),
    );
    expect(result.counts['arbitrary-layout-spacing']).toBe(0);
    expect(result.counts['raw-neutral-border']).toBe(0);
    expect(result.counts['standalone-raw-button']).toBe(0);
    expect(result.counts['consumer-hardcoded-color']).toBe(0);
  });

  it('keeps excluded paths out of the rule when the policy does not opt it in', () => {
    const result = evaluateDesignSystem(
      [
        {
          path: 'src/features/auth/Login.tsx',
          content: '<a className="bg-[#ff541b] text-white" />',
        },
      ],
      policy({ excludedPaths: landing }),
    );

    expect(result.counts['solid-orange-white-text']).toBe(0);
  });

  it('accepts a narrow large-text exception', () => {
    const value = 'bg-landing-action text-[19px] font-bold text-white';
    const result = evaluateDesignSystem(
      [{ path: 'src/features/auth/Login.tsx', content: `<a className="w-full ${value}" />` }],
      policy({
        excludedPaths: landing,
        scanExcludedPaths: ['solid-orange-white-text'],
        exceptions: [
          {
            path: 'src/features/auth/Login.tsx',
            ruleId: 'solid-orange-white-text',
            value,
            maxOccurrences: 1,
            kind: 'contrast-large-text',
            rationale: '19px bold is large text; 3.21:1 passes AA at 3:1',
            owner: 'design-system',
          },
        ],
      }),
    );

    expect(result.counts['solid-orange-white-text']).toBe(0);
    expect(result.errors).toEqual([]);
  });
});

describe('design-system policy file', () => {
  it('opts only the white-on-orange rule back into the excluded paths', () => {
    expect(repoPolicy.excludedPaths).toEqual(['src/features/landing/**', 'src/features/auth/**']);
    expect(repoPolicy.scanExcludedPaths).toEqual(['solid-orange-white-text']);
  });
});

describe('solid-orange-white-text in CSS', () => {
  const scanCss = (content: string, path = 'src/app/globals.css') =>
    evaluateDesignSystem([{ path, content }], policy());

  it.each([
    '.btn-primary {\n  height: 44px;\n  background: var(--brand-action);\n  color: var(--brand-action-text);\n}',
    '.graph-node-current {\n  background: var(--brand-action);\n  color: white;\n}',
    '.x { color: #fff; background-color: var(--cta); }',
    '.x { background: var(--accent); color: var(--neutral-white); }',
  ])('flags a CSS block with white text on a bright orange fill: %s', (css) => {
    const result = scanCss(css);

    expect(result.counts['solid-orange-white-text']).toBe(1);
    expect(result.errors).toContainEqual(expect.stringContaining('src/app/globals.css:'));
  });

  it.each([
    '.btn-primary { background: var(--brand-action-strong); color: var(--neutral-white); }',
    '.x { background: var(--brand-action); border-color: white; }',
    '.x { background: var(--brand-action); color: var(--ink); }',
    '.a { background: var(--brand-action); }\n.b { color: white; }',
  ])('passes a contrast-safe CSS block: %s', (css) => {
    expect(scanCss(css).counts['solid-orange-white-text']).toBe(0);
  });

  it('keeps the class-string rules off CSS files', () => {
    const result = scanCss('.x { color: #123456; border-color: rgba(0, 0, 0, 0.1); }');

    expect(result.counts['consumer-hardcoded-color']).toBe(0);
  });

  it('keeps the CSS rule off component files', () => {
    const result = evaluateDesignSystem(
      [
        {
          path: 'src/x.tsx',
          content: 'const css = `{ background: var(--accent); color: white; }`',
        },
      ],
      policy(),
    );

    expect(result.counts['solid-orange-white-text']).toBe(0);
  });
});
