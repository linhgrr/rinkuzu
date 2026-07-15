import { describe, expect, it } from 'vitest';

import { getUserDisplayName } from '@/components/user/user-identity';

describe('getUserDisplayName', () => {
  it('uses the preferred non-empty identity fields', () => {
    expect(
      getUserDisplayName({
        displayName: '  Rin  ',
        name: 'Fallback Name',
        email: 'fallback@example.com',
      }),
    ).toBe('Rin');
    expect(getUserDisplayName({ email: 'learner@example.com' })).toBe('learner');
  });

  it('falls back when an email has no local part', () => {
    expect(getUserDisplayName({ email: '@example.com' })).toBe('User');
  });
});
