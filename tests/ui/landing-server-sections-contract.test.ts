import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HOME_DIR = path.resolve(__dirname, '../../src/features/landing/components/home');

/**
 * RIN-1514: these landing sections only render markup, copy for both locales and the
 * client-side `Reveal` wrapper. As client components, all of that shipped in the
 * landing's first-load JS, which loads and runs before the hero's first paint on mobile.
 * As server components they keep the same HTML; only `Reveal` stays a client island.
 */
const SERVER_SECTIONS = [
  'Metrics.tsx',
  'StruggleSection.tsx',
  'HowItWorks.tsx',
  'CoreIntelligence.tsx',
];

describe('landing sections stay server components', () => {
  it.each(SERVER_SECTIONS)('%s has no "use client" directive', (file) => {
    const source = readFileSync(path.join(HOME_DIR, file), 'utf8');

    expect(source).not.toMatch(/^\s*['"]use client['"]/m);
  });

  it('keeps Reveal as the client island the sections use', () => {
    const source = readFileSync(path.join(HOME_DIR, 'Reveal.tsx'), 'utf8');

    expect(source).toMatch(/^'use client';/);
  });
});
