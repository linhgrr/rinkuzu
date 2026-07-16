import { describe, expect, it } from 'vitest';
import { isTypeOnlySource } from '../../scripts/check-coverage-gates.mjs';
import {
  isCriticalMutationFile,
  isTypeOnlyMutationFile,
  normalizeMutationPath,
  selectCriticalMutationFiles,
} from '../../scripts/mutation-scope.mjs';

describe('critical mutation scope', () => {
  it.each([
    'src/app/api/auth/register/route.ts',
    'src/lib/auth/session.ts',
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
    'src/repositories/types/AuthAccountPersistence.ts',
    'src/features/quiz/types/quiz-interaction-view-model.ts',
    'messages/en/adaptiveLearning.json',
    'src/services/other/OtherService.ts',
    'src/services/quiz/$(unsafe).ts',
    'src/lib/auth.ts',
  ])('excludes non-critical, test, presentation, type-only, or unsafe paths: %s', (file) => {
    expect(isCriticalMutationFile(file)).toBe(false);
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
