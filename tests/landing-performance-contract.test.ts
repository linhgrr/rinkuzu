import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('landing performance contract', () => {
  it('does not eagerly load the desktop-only hero character', () => {
    const source = fs.readFileSync('src/features/landing/components/home/Hero.tsx', 'utf8');
    const image = source.match(/<Image\s+alt="AI Character"[\s\S]*?\/>/)?.[0];

    expect(image).toBeDefined();
    expect(image).not.toMatch(/\bpriority\b/);
    expect(image).not.toMatch(/\bpreload\b/);
    expect(image).not.toMatch(/\bloading="eager"/);
    expect(image).toMatch(/\bloading="lazy"/);
  });

  it('paints the LCP headline without a full-element CSS filter layer', () => {
    const source = fs.readFileSync('src/features/landing/components/home/Hero.tsx', 'utf8');

    expect(source).toContain("textShadow: '4px 4px 0px #542607'");
    expect(source).not.toMatch(/style=\{\{\s*filter:/);
  });

  it('lets Next resize the above-fold background for the mobile viewport', () => {
    const source = fs.readFileSync(
      'src/features/landing/components/home/TextureBackground.tsx',
      'utf8',
    );
    const image = source.match(/<Image\s+alt=""[\s\S]*?src=\{imgImage2\}[\s\S]*?\/>/)?.[0];

    expect(image).toBeDefined();
    expect(image).toMatch(/\bsizes="100vw"/);
    expect(image).not.toMatch(/\bunoptimized\b/);
  });

  it('defers every below-fold landing section with an intrinsic layout placeholder', () => {
    const page = fs.readFileSync('src/features/landing/components/home/LandingPage.tsx', 'utf8');
    const styles = fs.readFileSync('src/app/globals.css', 'utf8');
    const deferredSections = page.match(/landing-deferred-section(?:--tall)?/g) ?? [];

    expect(deferredSections.length).toBeGreaterThanOrEqual(6);
    expect(styles).toMatch(/\.landing-deferred-section\s*\{[^}]*content-visibility:\s*auto;/s);
    expect(styles).toMatch(/contain-intrinsic-block-size:\s*auto\s+720px;/);
    expect(styles).toMatch(/contain-intrinsic-block-size:\s*auto\s+1100px;/);
  });
});
