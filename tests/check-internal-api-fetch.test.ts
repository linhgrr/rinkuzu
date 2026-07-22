import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = path.resolve('scripts/check-internal-api-fetch.mjs');
const tempRoots: string[] = [];

function makeProject(files: Record<string, string>) {
  const projectRoot = mkdtempSync(path.join(os.tmpdir(), 'internal-api-guard-'));
  tempRoots.push(projectRoot);

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(projectRoot, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }

  return projectRoot;
}

function runGuard(projectRoot: string) {
  try {
    return {
      ok: true,
      stdout: execFileSync(process.execPath, [scriptPath], {
        cwd: projectRoot,
        encoding: 'utf8',
      }),
      stderr: '',
    };
  } catch (error) {
    const execError = error as { stdout?: Buffer | string; stderr?: Buffer | string };

    return {
      ok: false,
      stdout: execError.stdout?.toString() ?? '',
      stderr: execError.stderr?.toString() ?? '',
    };
  }
}

describe('check-internal-api-fetch', () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      const projectRoot = tempRoots.pop();
      if (projectRoot) {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    }
  });

  it('flags indirect internal api fetch via const template variable', () => {
    const projectRoot = makeProject({
      'src/example.ts': `
        const quizUrl = \`/api/quizzes/\${'123'}\`;
        export async function loadQuiz() {
          return fetch(quizUrl);
        }
      `,
    });

    const result = runGuard(projectRoot);
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain('src/example.ts');
    expect(result.stderr).toContain('fetch("/api/quizzes/123")');
  });

  it('flags internal api fetch via object property and helper function', () => {
    const projectRoot = makeProject({
      'src/example.ts': `
        const ROUTES = { askAi: '/api/quiz/ask-ai' };
        function getRoute() {
          return ROUTES.askAi;
        }
        export async function ask() {
          return fetch(getRoute());
        }
      `,
    });

    const result = runGuard(projectRoot);
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain('src/example.ts');
    expect(result.stderr).toContain('fetch("/api/quiz/ask-ai")');
  });

  it('allows approved low-level boundaries', () => {
    const projectRoot = makeProject({
      'src/lib/ask-rin-chan/client.ts': `
        export async function askRinChan() {
          return fetch('/api/ask-rin-chan/chat');
        }
      `,
    });

    const result = runGuard(projectRoot);
    expect(result.ok).toBe(true);
    expect(result.stdout).toContain('Internal API fetch guard passed.');
  });
});
