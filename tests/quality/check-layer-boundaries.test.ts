import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const root = process.cwd();
const checkerPath = path.join(root, 'scripts', 'check-layer-boundaries.mjs');
const temporaryDirectories: string[] = [];

/**
 * The six files scripts/check-layer-boundaries.mjs freezes as pre-existing
 * "only repositories touch models" debt. Kept in sync with the checker's
 * allowedPersistenceModelAccessDebt by hand — a fixture drifting from that
 * list is exactly what these tests exist to catch.
 */
const frozenViolators = [
  'src/lib/audit.ts',
  'src/lib/communication/campaigns.ts',
  'src/lib/communication/feedback.ts',
  'src/lib/communication/internal.ts',
  'src/lib/communication/support.ts',
  'src/lib/communication/worker.ts',
];

function modelImport(): string {
  return "import { Placeholder } from '@/models/Placeholder';\n\nexport const touchesModel = Placeholder;\n";
}

/**
 * A persistence reach the "only repositories touch models" ratchet cannot see.
 * That ratchet only matches `@/models/`, so `@/repositories/` and a bare
 * `mongoose` import are caught by `presentation -> persistence` alone — which
 * is why these fixtures use them rather than modelImport().
 */
function repositoryImport(): string {
  return "import { FooRepository } from '@/repositories/FooRepository';\n\nexport const reachesRepository = FooRepository;\n";
}

function mongooseImport(): string {
  return "import mongoose from 'mongoose';\n\nexport const reachesMongoose = mongoose;\n";
}

function writeFile(sandbox: string, relativePath: string, contents: string): void {
  const filePath = path.join(sandbox, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function makeSandbox(): string {
  const sandbox = mkdtempSync(path.join(tmpdir(), 'rinkuzu-layer-boundaries-'));
  temporaryDirectories.push(sandbox);
  // src/features and src/components are read with fs.readdirSync directly
  // (not the tolerant walk() helper the rest of the checker uses), so they
  // must exist even when empty or the checker throws before it gets to any
  // ratchet.
  mkdirSync(path.join(sandbox, 'src', 'features'), { recursive: true });
  mkdirSync(path.join(sandbox, 'src', 'components'), { recursive: true });
  for (const relativePath of frozenViolators) {
    writeFile(sandbox, relativePath, modelImport());
  }
  return sandbox;
}

function runChecker(sandbox: string) {
  return spawnSync(process.execPath, [checkerPath], { cwd: sandbox, encoding: 'utf8' });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('persistence-layer model access ratchet', () => {
  it('passes a sandbox that matches exactly the frozen six-file allowlist', () => {
    const sandbox = makeSandbox();

    const result = runChecker(sandbox);

    expect(result.status).toBe(0);
  });

  it('fails on a new violation outside the frozen allowlist', () => {
    const sandbox = makeSandbox();
    writeFile(sandbox, 'src/lib/newViolator.ts', modelImport());

    const result = runChecker(sandbox);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'non-persistence -> models: new violation in src/lib/newViolator.ts',
    );
  });

  it('fails when a frozen entry no longer violates, so the list self-cleans', () => {
    const sandbox = makeSandbox();
    writeFile(sandbox, 'src/lib/audit.ts', 'export const clean = true;\n');

    const result = runChecker(sandbox);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'non-persistence -> models: remove resolved debt entry for src/lib/audit.ts',
    );
  });

  it('does not flag repositories importing models (legitimate persistence access)', () => {
    const sandbox = makeSandbox();
    writeFile(sandbox, 'src/repositories/FooRepository.ts', modelImport());

    const result = runChecker(sandbox);

    expect(result.status).toBe(0);
  });

  it('does not flag models importing sibling models', () => {
    const sandbox = makeSandbox();
    writeFile(sandbox, 'src/models/Foo.ts', modelImport());

    const result = runChecker(sandbox);

    expect(result.status).toBe(0);
  });

  it('does not flag test files', () => {
    const sandbox = makeSandbox();
    writeFile(sandbox, 'src/lib/foo.test.ts', modelImport());

    const result = runChecker(sandbox);

    expect(result.status).toBe(0);
  });
});

describe('presentation-layer persistence ratchet', () => {
  it('flags a shared component reaching into a repository', () => {
    const sandbox = makeSandbox();
    writeFile(sandbox, 'src/components/SharedThing.tsx', repositoryImport());

    const result = runChecker(sandbox);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'presentation -> persistence: new violation in src/components/SharedThing.tsx',
    );
  });

  it('flags a shared component importing mongoose directly', () => {
    const sandbox = makeSandbox();
    writeFile(sandbox, 'src/components/SharedThing.tsx', mongooseImport());

    const result = runChecker(sandbox);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'presentation -> persistence: new violation in src/components/SharedThing.tsx',
    );
  });

  it('flags a feature module reaching into a repository', () => {
    const sandbox = makeSandbox();
    writeFile(sandbox, 'src/features/quiz/components/QuizThing.tsx', repositoryImport());

    const result = runChecker(sandbox);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'presentation -> persistence: new violation in src/features/quiz/components/QuizThing.tsx',
    );
  });

  it('still flags a page under src/app, the surface it always covered', () => {
    const sandbox = makeSandbox();
    writeFile(sandbox, 'src/app/dashboard/page.tsx', repositoryImport());

    const result = runChecker(sandbox);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'presentation -> persistence: new violation in src/app/dashboard/page.tsx',
    );
  });

  it('leaves a component that touches no persistence alone', () => {
    const sandbox = makeSandbox();
    writeFile(sandbox, 'src/components/SharedThing.tsx', 'export const shared = true;\n');

    const result = runChecker(sandbox);

    expect(result.status).toBe(0);
  });
});

describe('persistence -> dto ratchet', () => {
  /**
   * The mirror of dto -> domain. Until 2026-08-31 only one direction was
   * guarded, so a persistence record could import the wire shape and the check
   * stayed green.
   */
  function dtoImport(): string {
    return "import type { PaginationMeta } from '@/dtos/common';\n\nexport type Reaches = PaginationMeta;\n";
  }

  it.each([
    'src/repositories/types/DashboardPersistence.ts',
    'src/interfaces/repositories/IDashboardRepository.ts',
    'src/models/Report.ts',
  ])('fails when %s imports a DTO', (relativePath) => {
    const sandbox = makeSandbox();
    writeFile(sandbox, relativePath, dtoImport());

    const result = runChecker(sandbox);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`persistence -> dto: new violation in ${relativePath}`);
  });

  it('leaves the other direction to the dto -> domain rule', () => {
    // A DTO reaching into persistence is a different rule with a different
    // message; this one must not also claim it.
    const sandbox = makeSandbox();
    writeFile(sandbox, 'src/dtos/leaky.ts', repositoryImport());

    const result = runChecker(sandbox);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('dto -> domain: new violation in src/dtos/leaky.ts');
    expect(result.stderr).not.toContain('persistence -> dto');
  });

  it('allows persistence to import its own sibling types', () => {
    const sandbox = makeSandbox();
    writeFile(
      sandbox,
      'src/repositories/types/FooPersistence.ts',
      "import type { MongoIdLike } from '@/types/mongo';\n\nexport interface Foo {\n  _id: MongoIdLike;\n}\n",
    );

    const result = runChecker(sandbox);

    expect(result.status).toBe(0);
  });
});
