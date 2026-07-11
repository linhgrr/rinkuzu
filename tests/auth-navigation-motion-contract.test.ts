import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const authShellSource = readFileSync('src/components/auth/AuthShell.tsx', 'utf8');

describe('auth motion contract', () => {
  it('preserves the deployed login/register transition', () => {
    expect(authShellSource).toContain('const duration = reduceMotion ? 0 : 0.35;');
    expect(authShellSource).toContain('<motion.div\n        layout');
    expect(authShellSource).toContain('initial="initial"');
    expect(authShellSource).toContain('<AnimatePresence mode="wait" initial={false}>');
  });
});
