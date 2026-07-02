import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn(async (password: string) => `argon2:${password}`),
}));

import { hashPassword } from '@/lib/password';
import { buildSuccessfulLoginPasswordUpdate } from '@/lib/auth/password-rehash';

describe('buildSuccessfulLoginPasswordUpdate', () => {
  it('does not update current argon2 hashes', async () => {
    await expect(
      buildSuccessfulLoginPasswordUpdate('secret', {
        valid: true,
        algorithm: 'argon2id',
        needsRehash: false,
      }),
    ).resolves.toEqual({});
    expect(hashPassword).not.toHaveBeenCalled();
  });

  it('rehashes successful bcrypt verification results to argon2', async () => {
    await expect(
      buildSuccessfulLoginPasswordUpdate('secret', {
        valid: true,
        algorithm: 'bcrypt',
        needsRehash: true,
      }),
    ).resolves.toEqual({ password: 'argon2:secret' });
    expect(hashPassword).toHaveBeenCalledWith('secret');
  });

  it('does not update failed legacy verification results', async () => {
    await expect(
      buildSuccessfulLoginPasswordUpdate('secret', {
        valid: false,
        algorithm: 'bcrypt',
        needsRehash: false,
      }),
    ).resolves.toEqual({});
  });
});
