import { afterEach, describe, expect, it, vi } from 'vitest';

const originalJwtSecret = process.env['JWT_SECRET'];

vi.mock('server-only', () => ({}));

describe('jwt env hardening', () => {
  afterEach(() => {
    vi.resetModules();
    if (originalJwtSecret === undefined) {
      delete process.env['JWT_SECRET'];
    } else {
      process.env['JWT_SECRET'] = originalJwtSecret;
    }
  });

  it('throws when JWT_SECRET is missing', async () => {
    delete process.env['JWT_SECRET'];

    await expect(import('./jwt')).rejects.toThrow('JWT_SECRET required');
  });

  it('signs tokens when JWT_SECRET is configured', async () => {
    process.env['JWT_SECRET'] = 'test-jwt-secret';

    const { signToken } = await import('./jwt');

    expect(
      signToken({
        id: 'user-1',
        email: 'user@example.com',
        role: 'user',
      }),
    ).toEqual(expect.any(String));
  });
});
