import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const loginFormSource = readFileSync('src/components/auth/LoginForm.tsx', 'utf8');
const authShellSource = readFileSync('src/components/auth/AuthShell.tsx', 'utf8');

describe('auth navigation and motion contracts', () => {
  it('performs one client navigation after credentials login', () => {
    expect(loginFormSource).toContain('replace(callbackUrl);');
    expect(loginFormSource).not.toContain('prefetch(callbackUrl)');
    expect(loginFormSource).not.toContain('refresh();');
  });

  it('preserves the deployed login/register transition', () => {
    expect(authShellSource).toContain('const duration = reduceMotion ? 0 : 0.35;');
    expect(authShellSource).toContain('<motion.div\n        layout');
    expect(authShellSource).toContain('initial="initial"');
    expect(authShellSource).toContain('<AnimatePresence mode="wait" initial={false}>');
  });
});
