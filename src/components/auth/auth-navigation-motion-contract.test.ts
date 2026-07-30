import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const authShellSource = readFileSync('src/components/auth/AuthShell.tsx', 'utf8');
const globalStylesSource = readFileSync('src/app/globals.css', 'utf8');

describe('auth motion and palette contracts', () => {
  it('preserves the deployed login/register transition', () => {
    expect(authShellSource).toContain('const duration = reduceMotion ? 0 : 0.35;');
    expect(authShellSource).toContain('LazyMotion');
    expect(authShellSource).toContain('domAnimation');
    expect(authShellSource).toMatch(/<m\.div[\s\S]*?layout/);
    expect(authShellSource).toContain('initial="initial"');
    expect(authShellSource).toContain('<AnimatePresence mode="wait" initial={false}>');
  });

  it('keeps the original auth palette scoped away from global contrast tokens', () => {
    expect(authShellSource).toContain('className="auth-shell flex');
    expect(globalStylesSource).toMatch(/\.auth-shell\s*{[\s\S]*?--brand-trust:\s*var\(--accent\);/);
  });
});
