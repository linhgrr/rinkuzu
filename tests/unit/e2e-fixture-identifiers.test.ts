import { describe, expect, it } from 'vitest';
import { emailSchema } from '@/lib/validation/auth';
import { createE2EUserEmail, type E2EUserKind } from '../e2e/support/fixture-identifiers';

describe('critical E2E fixture identifiers', () => {
  const longestObservedRunId =
    'mobile-webkit-critical-ee4a48b6-7056-4787-80e0-c615b70edae4-with-future-project-suffixes';

  it.each<E2EUserKind>(['admin', 'regular', 'target'])(
    'creates a standards-compliant %s email independent of project-name length',
    (kind) => {
      const email = createE2EUserEmail(kind, longestObservedRunId);
      const [localPart] = email.split('@');

      expect(emailSchema.parse(email)).toBe(email);
      expect(localPart?.length).toBeLessThanOrEqual(64);
    },
  );

  it('is deterministic per run and separates user kinds', () => {
    const first = createE2EUserEmail('regular', longestObservedRunId);

    expect(createE2EUserEmail('regular', longestObservedRunId)).toBe(first);
    expect(createE2EUserEmail('admin', longestObservedRunId)).not.toBe(first);
    expect(createE2EUserEmail('regular', `${longestObservedRunId}-other`)).not.toBe(first);
  });
});
