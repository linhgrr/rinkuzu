import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { isTypeOnlySource } from '../../scripts/check-coverage-gates.mjs';
import {
  escapeStrykerMutatePattern,
  formatStrykerMutateOutput,
  isCriticalMutationFile,
  isTypeOnlyMutationFile,
  literalPathFromStrykerMutatePattern,
  normalizeMutationPath,
  selectCriticalMutationFiles,
  strykerMutateInputMatchesScopeFiles,
  toStrykerMutatePatterns,
} from '../../scripts/mutation-scope.mjs';

const require = createRequire(import.meta.url);
// Real Stryker 9.6.1 FileMatcher (normalizeFileName then minimatch).
const { FileMatcher } = require(
  path.resolve('node_modules/@stryker-mutator/core/dist/src/config/file-matcher.js'),
) as {
  FileMatcher: new (
    pattern: string | boolean,
    allowHiddenFiles?: boolean,
  ) => {
    matches(fileName: string): boolean;
  };
};
const { normalizeFileName } = require(
  path.resolve('node_modules/@stryker-mutator/util/dist/src/string-utils.js'),
) as { normalizeFileName: (fileName: string) => string };

/** Match the way Stryker FileMatcher resolves both sides before minimatch. */
function strykerMatches(fileName: string, pattern: string): boolean {
  return new FileMatcher(pattern).matches(fileName);
}

describe('critical mutation scope', () => {
  it.each([
    'src/app/api/auth/register/route.ts',
    'src/app/api/folders/[id]/route.ts',
    'src/app/api/auth/[...nextauth]/route.ts',
    'src/auth.ts',
    'src/auth.config.ts',
    'src/lib/auth/session.ts',
    'src/lib/password.ts',
    'src/lib/auth-tokens.ts',
    'src/shared/constants/account-disable.ts',
    'src/shared/constants/admin-invariant.ts',
    'src/lib/security/trusted-navigation.ts',
    'src/models/User.ts',
    'src/repositories/UserRepository.ts',
    'src/services/subscription/SubscriptionService.ts',
    'src/features/quiz/hooks/useQuizProgress.ts',
  ])('includes production control logic: %s', (file) => {
    expect(isCriticalMutationFile(file)).toBe(true);
  });

  it.each([
    'src/features/quiz/components/QuizCard.tsx',
    'src/features/quiz/hooks/useQuizProgress.test.tsx',
    'src/models/User.test.ts',
    'src/lib/password.test.ts',
    'src/lib/auth-tokens.test.ts',
    'src/lib/security/trusted-navigation.test.ts',
    'src/repositories/types/AuthAccountPersistence.ts',
    'src/features/quiz/types/quiz-interaction-view-model.ts',
    'messages/en/adaptiveLearning.json',
    'src/services/other/OtherService.ts',
    'src/services/quiz/$(unsafe).ts',
    // Directory-shaped path is not a runtime module; covered by src/lib/auth/**/*.ts.
    'src/lib/auth.ts',
    'src/app/api/auth/[id]/route.ts with spaces',
    'src/app/api/auth/`id`/route.ts',
    'src/app/api/auth/$(id)/route.ts',
    'src/app/api/auth/id;rm/route.ts',
    'src/app/api/auth/id|rm/route.ts',
    '../src/app/api/auth/[id]/route.ts',
  ])('excludes non-critical, test, presentation, type-only, or unsafe paths: %s', (file) => {
    expect(isCriticalMutationFile(file)).toBe(false);
  });

  it('selects auth/security runtime entrypoints and drops co-located tests', () => {
    const selected = selectCriticalMutationFiles([
      'src/auth.ts',
      'src/auth.config.ts',
      'src/lib/password.ts',
      'src/lib/password.test.ts',
      'src/lib/auth-tokens.ts',
      'src/lib/auth-tokens.test.ts',
      'src/shared/constants/account-disable.ts',
      'src/shared/constants/admin-invariant.ts',
      'src/lib/security/trusted-navigation.ts',
      'src/lib/security/trusted-navigation.test.ts',
      'src/lib/auth.ts',
      'messages/en/common.json',
    ]);

    expect(selected).toEqual([
      'src/auth.config.ts',
      'src/auth.ts',
      'src/lib/auth-tokens.ts',
      'src/lib/password.ts',
      'src/lib/security/trusted-navigation.ts',
      'src/shared/constants/account-disable.ts',
      'src/shared/constants/admin-invariant.ts',
    ]);
  });

  it('selects bracketed Next.js API route files as critical', () => {
    const selected = selectCriticalMutationFiles([
      'src/app/api/folders/[id]/route.ts',
      'src/app/api/auth/[...nextauth]/route.ts',
      'src/app/api/quiz/[slug]/route.ts',
      'src/features/quiz/components/QuizCard.tsx',
      'src/services/quiz/$(unsafe).ts',
      'src/app/api/auth/[id]/route.ts; rm -rf /',
    ]);

    expect(selected).toEqual([
      'src/app/api/auth/[...nextauth]/route.ts',
      'src/app/api/folders/[id]/route.ts',
      'src/app/api/quiz/[slug]/route.ts',
    ]);
  });

  it('normalizes, deduplicates, and sorts changed paths', () => {
    expect(
      selectCriticalMutationFiles([
        './src/models/User.ts',
        'src\\models\\User.ts',
        'src/services/quiz/QuizService.ts',
        'src/models/User.test.ts',
      ]),
    ).toEqual(['src/models/User.ts', 'src/services/quiz/QuizService.ts']);
    expect(normalizeMutationPath('.\\src\\models\\User.ts')).toBe('src/models/User.ts');
  });

  it('excludes type-only sources via AST while retaining runtime modules', () => {
    const typeOnly =
      "import type { A } from './a';\nexport type B = A;\nexport interface C { x: A }\n";
    const runtime = "import type { A } from './a';\nexport const answer = 42;\n";
    const valueImport = "import { A } from './a';\nexport type B = typeof A;\n";
    const enumRuntime = 'export enum Mode { On, Off }\n';

    expect(isTypeOnlySource(typeOnly)).toBe(true);
    expect(isTypeOnlySource(runtime)).toBe(false);
    expect(isTypeOnlySource(valueImport)).toBe(false);
    expect(isTypeOnlySource(enumRuntime)).toBe(false);

    expect(
      isTypeOnlyMutationFile('src/features/quiz/types/synthetic.ts', { sourceText: typeOnly }),
    ).toBe(true);
    expect(
      isTypeOnlyMutationFile('src/features/quiz/lib/synthetic.ts', { sourceText: runtime }),
    ).toBe(false);
    expect(
      isCriticalMutationFile('src/features/quiz/types/synthetic.ts', { sourceText: typeOnly }),
    ).toBe(false);
    expect(
      isCriticalMutationFile('src/features/quiz/lib/synthetic.ts', { sourceText: runtime }),
    ).toBe(true);
    expect(
      isCriticalMutationFile('src/features/quiz/lib/with-value-import.ts', {
        sourceText: valueImport,
      }),
    ).toBe(true);
    expect(
      isCriticalMutationFile('src/features/quiz/lib/mode.ts', { sourceText: enumRuntime }),
    ).toBe(true);
  });

  it('fail-closed keeps critical candidates when source cannot be proven type-only', () => {
    expect(
      isTypeOnlyMutationFile('src/features/quiz/lib/missing-on-disk.ts', {
        root: '/tmp/does-not-exist-mutation-scope',
      }),
    ).toBe(false);
    expect(
      isCriticalMutationFile('src/features/quiz/lib/missing-on-disk.ts', {
        root: '/tmp/does-not-exist-mutation-scope',
      }),
    ).toBe(true);
  });

  it('selection drops type-only critical paths and keeps runtime ones', () => {
    const selected = selectCriticalMutationFiles(
      [
        'src/features/quiz/types/quiz-interaction-view-model.ts',
        'src/features/quiz/hooks/useQuizProgress.ts',
        'src/repositories/types/AuthAccountPersistence.ts',
        'src/models/User.test.ts',
        'src/services/quiz/$(unsafe).ts',
      ],
      {},
    );

    expect(selected).toEqual(['src/features/quiz/hooks/useQuizProgress.ts']);
    expect(selected).not.toContain('src/features/quiz/types/quiz-interaction-view-model.ts');
  });
});

describe('Stryker mutate handoff escaping', () => {
  const bracketFiles = [
    'src/app/api/folders/[id]/route.ts',
    'src/app/api/auth/[...nextauth]/route.ts',
    'src/app/api/quiz/[slug]/route.ts',
    'src/app/api/quiz/[[...optional]]/route.ts',
  ] as const;

  const plainFile = 'src/repositories/AccountRepository.ts';

  /** Reviewer C changed-mode scope (17 files, 4 bracketed Next.js routes). */
  const reviewerCScopeFiles = [
    'src/app/api/quiz-drafts/[id]/submit/route.ts',
    'src/app/api/quiz/[slug]/discussions/route.ts',
    'src/app/api/quiz/[slug]/report/route.ts',
    'src/app/api/quizzes/[id]/route.ts',
    'src/features/admin/quizzes/mappers/admin-quizzes.mapper.ts',
    'src/features/quiz/hooks/useStreamingChatSession.ts',
    'src/lib/adaptive/proxy.ts',
    'src/models/Attempt.ts',
    'src/models/schemas/QuizQuestionSchema.ts',
    'src/repositories/AccountRepository.ts',
    'src/repositories/AttemptRepository.ts',
    'src/repositories/UserRepository.ts',
    'src/repositories/helpers/deleteQuizDependents.ts',
    'src/repositories/mappers/QuizPersistenceMapper.ts',
    'src/services/quiz/QuizCrudService.ts',
    'src/services/quiz/QuizDiscussionService.ts',
    'src/services/quiz/QuizService.ts',
  ] as const;

  const reviewerCDecoys = [
    'src/app/api/quiz-drafts/id/submit/route.ts',
    'src/app/api/quiz/slug/discussions/route.ts',
    'src/app/api/quiz/x/discussions/route.ts',
    'src/app/api/quizzes/id/route.ts',
    'src/app/api/quiz-drafts/[idx]/submit/route.ts',
    'src/app/api/quiz/[slug]/discussions/route.tsx',
  ] as const;

  it('preserves literal bracket paths in critical selection (scope.files shape)', () => {
    const selected = selectCriticalMutationFiles([...bracketFiles, plainFile]);

    expect(selected).toEqual([
      'src/app/api/auth/[...nextauth]/route.ts',
      'src/app/api/folders/[id]/route.ts',
      'src/app/api/quiz/[[...optional]]/route.ts',
      'src/app/api/quiz/[slug]/route.ts',
      'src/repositories/AccountRepository.ts',
    ]);
    for (const file of selected) {
      expect(file).not.toContain('\\');
    }
  });

  it.each([
    ['[id]', '[[]id]'],
    ['[...nextauth]', '[[]...nextauth]'],
    ['[[...optional]]', '[[][[]...optional]]'],
    ['src/app/api/folders/[id]/route.ts', 'src/app/api/folders/[[]id]/route.ts'],
    ['src/app/api/auth/[...nextauth]/route.ts', 'src/app/api/auth/[[]...nextauth]/route.ts'],
    ['src/app/api/quiz/[slug]/route.ts', 'src/app/api/quiz/[[]slug]/route.ts'],
    ['src/app/api/quiz/[[...optional]]/route.ts', 'src/app/api/quiz/[[][[]...optional]]/route.ts'],
    ['src/repositories/AccountRepository.ts', 'src/repositories/AccountRepository.ts'],
    ['.\\src\\models\\User.ts', 'src/models/User.ts'],
  ] as const)('escapes [ via FileMatcher-safe [[] form: %s', (input, expected) => {
    expect(escapeStrykerMutatePattern(input)).toBe(expected);
    // Survives Stryker normalizeFileName (backslash → slash).
    expect(normalizeFileName(escapeStrykerMutatePattern(input))).toBe(expected);
  });

  it('formats GITHUB_OUTPUT / --mutate handoff as comma-joined escaped patterns', () => {
    const files = [
      'src/app/api/folders/[id]/route.ts',
      'src/repositories/AccountRepository.ts',
      'src/app/api/quiz/[slug]/route.ts',
    ];

    expect(toStrykerMutatePatterns(files)).toEqual([
      'src/app/api/folders/[[]id]/route.ts',
      'src/repositories/AccountRepository.ts',
      'src/app/api/quiz/[[]slug]/route.ts',
    ]);
    expect(formatStrykerMutateOutput(files)).toBe(
      'src/app/api/folders/[[]id]/route.ts,src/repositories/AccountRepository.ts,src/app/api/quiz/[[]slug]/route.ts',
    );
  });

  it('escaped mutate patterns match only the literal intended files under real FileMatcher', () => {
    const candidates = [
      ...bracketFiles,
      plainFile,
      'src/app/api/folders/id/route.ts',
      'src/app/api/folders/x/route.ts',
      'src/app/api/quiz/slug/route.ts',
      'src/app/api/auth/nextauth/route.ts',
    ];

    for (const target of bracketFiles) {
      const pattern = escapeStrykerMutatePattern(target);
      const matches = candidates.filter((candidate) => strykerMatches(candidate, pattern));
      expect(matches).toEqual([target]);
    }

    const plainPattern = escapeStrykerMutatePattern(plainFile);
    expect(candidates.filter((candidate) => strykerMatches(candidate, plainPattern))).toEqual([
      plainFile,
    ]);
  });

  it('all 17 reviewer-C scope escapes match exact files and not decoys under FileMatcher', () => {
    expect(reviewerCScopeFiles).toHaveLength(17);
    const candidates = [...reviewerCScopeFiles, ...reviewerCDecoys];

    for (const target of reviewerCScopeFiles) {
      const pattern = escapeStrykerMutatePattern(target);
      expect(pattern).not.toContain('\\');
      expect(normalizeFileName(pattern)).toBe(pattern);
      const matches = candidates.filter((candidate) => strykerMatches(candidate, pattern));
      expect(matches).toEqual([target]);
      expect(literalPathFromStrykerMutatePattern(pattern)).toBe(target);
    }

    const patterns = toStrykerMutatePatterns([...reviewerCScopeFiles]);
    expect(strykerMutateInputMatchesScopeFiles(patterns, [...reviewerCScopeFiles])).toBe(true);
    // Legacy backslash escapes (destroyed by normalizeFileName) must not bind.
    const legacyBackslash = reviewerCScopeFiles.map((file) =>
      file.replaceAll('[', '\\[').replaceAll(']', '\\]'),
    );
    expect(strykerMutateInputMatchesScopeFiles(legacyBackslash, [...reviewerCScopeFiles])).toBe(
      false,
    );
    for (const legacy of legacyBackslash.filter((p) => p.includes('\\'))) {
      expect(strykerMatches(legacy.replaceAll('\\', ''), legacy)).toBe(false);
    }
  });

  it('unescaped bracket paths do not match their own literal files (the Stryker bug)', () => {
    for (const target of bracketFiles) {
      expect(strykerMatches(target, target)).toBe(false);
    }
  });

  it('relates escaped mutate patterns back to literal scope files for evidence binding', () => {
    const scopeFiles = selectCriticalMutationFiles([...bracketFiles, plainFile]);
    const mutatePatterns = toStrykerMutatePatterns(scopeFiles);

    expect(mutatePatterns.map(literalPathFromStrykerMutatePattern)).toEqual(scopeFiles);
    expect(strykerMutateInputMatchesScopeFiles(mutatePatterns, scopeFiles)).toBe(true);
    expect(strykerMutateInputMatchesScopeFiles(scopeFiles, scopeFiles)).toBe(false);
    expect(strykerMutateInputMatchesScopeFiles(mutatePatterns, scopeFiles.slice(0, -1))).toBe(
      false,
    );
  });

  it('rejects extra, missing, wrong, and unescaped mutate patterns against scope.files', () => {
    const scopeFiles = [
      'src/app/api/folders/[id]/route.ts',
      'src/app/api/auth/[...nextauth]/route.ts',
      'src/app/api/quiz/[[...optional]]/route.ts',
    ];
    const escaped = toStrykerMutatePatterns(scopeFiles);

    expect(strykerMutateInputMatchesScopeFiles(escaped, scopeFiles)).toBe(true);
    expect(
      strykerMutateInputMatchesScopeFiles(
        [...escaped, 'src/repositories/AccountRepository.ts'],
        scopeFiles,
      ),
    ).toBe(false);
    expect(strykerMutateInputMatchesScopeFiles(escaped.slice(0, 2), scopeFiles)).toBe(false);
    expect(
      strykerMutateInputMatchesScopeFiles(
        [
          'src/app/api/folders/[[]id]/route.ts',
          'src/app/api/auth/[[]...nextauth]/route.ts',
          'src/app/api/quiz/[[]slug]/route.ts',
        ],
        scopeFiles,
      ),
    ).toBe(false);
    // Unescaped brackets (pre-fix handoff) must not bind.
    expect(strykerMutateInputMatchesScopeFiles(scopeFiles, scopeFiles)).toBe(false);
    // Legacy backslash escapes must not bind.
    expect(
      strykerMutateInputMatchesScopeFiles(
        [
          'src/app/api/folders/\\[id\\]/route.ts',
          'src/app/api/auth/\\[...nextauth\\]/route.ts',
          'src/app/api/quiz/\\[\\[...optional\\]\\]/route.ts',
        ],
        scopeFiles,
      ),
    ).toBe(false);
    // Resolver GITHUB_OUTPUT shape is comma-joined escaped patterns.
    expect(formatStrykerMutateOutput(scopeFiles).split(',')).toEqual(escaped);
  });

  it('keeps unsafe path rejection independent of mutate escaping', () => {
    expect(isCriticalMutationFile('src/app/api/auth/[id]/route.ts; rm -rf /')).toBe(false);
    expect(isCriticalMutationFile('src/services/quiz/$(unsafe).ts')).toBe(false);
    expect(escapeStrykerMutatePattern('src/app/api/folders/[id]/route.ts')).toBe(
      'src/app/api/folders/[[]id]/route.ts',
    );
    expect(escapeStrykerMutatePattern('src/app/api/folders/[id]/route.ts')).not.toContain('\\');
  });
});
