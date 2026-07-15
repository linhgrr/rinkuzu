import { describe, expect, it } from 'vitest';
import {
  isCriticalMutationFile,
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
    'messages/en/adaptiveLearning.json',
    'src/services/other/OtherService.ts',
    'src/services/quiz/$(unsafe).ts',
  ])('excludes non-critical, test, presentation, or unsafe paths: %s', (file) => {
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
});
