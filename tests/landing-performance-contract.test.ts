import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('landing performance contract', () => {
  it('prioritizes stable first paint over a late display-font swap', () => {
    const source = fs.readFileSync('src/features/landing/components/home/LandingPage.tsx', 'utf8');
    const unbounded = source.match(/const unbounded = Unbounded\(\{[\s\S]*?\}\);/)?.[0];
    const vinaSans = source.match(/const vinaSans = Vina_Sans\(\{[\s\S]*?\}\);/)?.[0];

    expect(unbounded).toBeDefined();
    expect(unbounded).toContain("display: 'optional'");
    expect(unbounded).not.toContain('weight:');
    expect(vinaSans).toBeDefined();
    expect(vinaSans).toContain("display: 'optional'");
    expect(vinaSans).toContain('preload: false');
  });

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

  it('renders the landing header without a hydrated mobile-menu state machine', () => {
    const source = fs.readFileSync('src/features/landing/components/home/Header.tsx', 'utf8');

    expect(source).not.toContain("'use client'");
    expect(source).not.toMatch(/\buseState\b/);
    expect(source).not.toMatch(/\bonClick=/);
    expect(source).toContain('<details className="group md:hidden">');
    expect(source).toContain('aria-label="Toggle navigation menu"');
  });

  it('keeps landing CTAs server-rendered without the pointer-tracking wrapper', () => {
    const hero = fs.readFileSync('src/features/landing/components/home/Hero.tsx', 'utf8');
    const bottomCta = fs.readFileSync('src/features/landing/components/home/BottomCta.tsx', 'utf8');

    expect(hero).not.toContain('Magnetic');
    expect(bottomCta).not.toContain('Magnetic');
    expect(fs.existsSync('src/features/landing/components/home/Magnetic.tsx')).toBe(false);
  });

  it('server-renders an accessible testimonials marquee without Embla hydration', () => {
    const source = fs.readFileSync('src/features/landing/components/home/Testimonials.tsx', 'utf8');
    const styles = fs.readFileSync('src/app/globals.css', 'utf8');

    expect(source).not.toContain("'use client'");
    expect(source).not.toMatch(/\buse(?:Effect|Ref|EmblaCarousel)\b/);
    expect(source).not.toContain('embla-carousel');
    expect(source).toContain('[false, true].flatMap');
    expect(source).toContain('aria-hidden={duplicate || undefined}');
    expect(styles).toMatch(
      /\.landing-testimonials-track\s*\{[^}]*animation:\s*landing-marquee\s+45s\s+linear\s+infinite;/s,
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.landing-testimonials-track\s*\{[^}]*animation:\s*none;/,
    );
  });

  it('isolates the homepage from generic marketing client chrome', () => {
    const landingRoute = 'src/app/[locale]/(landing)/page.tsx';

    expect(fs.existsSync(landingRoute)).toBe(true);
    expect(fs.existsSync('src/app/[locale]/(marketing)/page.tsx')).toBe(false);
    const source = fs.readFileSync(landingRoute, 'utf8');
    expect(source).toContain(
      '<GuestLanding locale={locale} isAuthenticated={Boolean(session?.user)} />',
    );
    expect(source).not.toContain('@/i18n/navigation');
    expect(source).toContain('redirectToLocalizedPath(ROUTES.DASHBOARD, locale)');

    const redirectBoundary = fs.readFileSync('src/lib/routing/localized-redirect.ts', 'utf8');
    expect(redirectBoundary).toContain("import 'server-only'");
    expect(redirectBoundary).toContain('redirect(toBrowserPath(pathWithoutLocale, locale))');

    const eslintConfig = fs.readFileSync('eslint.config.mjs', 'utf8');
    expect(eslintConfig).toContain("files: ['src/lib/routing/localized-redirect.ts']");
    expect(eslintConfig).toContain(
      "This server-only boundary may import redirect only. Keep client navigation in '@/i18n/navigation'.",
    );
  });

  it('server-renders locale-prefixed landing links without a client navigation layer', () => {
    const componentPaths = [
      'src/features/landing/components/home/Header.tsx',
      'src/features/landing/components/home/Hero.tsx',
      'src/features/landing/components/home/BottomCta.tsx',
      'src/features/landing/components/home/Footer.tsx',
    ];

    for (const componentPath of componentPaths) {
      const source = fs.readFileSync(componentPath, 'utf8');
      expect(source).not.toContain('@/i18n/navigation');
      expect(source).not.toContain("from 'next/link'");
      expect(source).toContain('toBrowserPath(');
      expect(source).toMatch(/<a\s[\s\S]*?href=\{?/);
    }
  });

  it('server-renders the responsive how-it-works layout without ResizeObserver hydration', () => {
    const source = fs.readFileSync('src/features/landing/components/home/HowItWorks.tsx', 'utf8');

    expect(source).not.toContain("'use client'");
    expect(source).not.toMatch(/\b(?:useEffect|useRef|useState|ResizeObserver)\b/);
    expect(source).toContain('aspect-[1728/387]');
    expect(source).toContain('grid grid-cols-3');
    expect(source).toContain('gap-[clamp(24px,5vw,96px)]');
  });
});
