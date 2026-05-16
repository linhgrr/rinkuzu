import { describe, expect, it, vi } from 'vitest';

const { mockArgonHash, mockArgonVerify, mockBcryptCompare } = vi.hoisted(() => ({
  mockArgonHash: vi.fn(),
  mockArgonVerify: vi.fn(),
  mockBcryptCompare: vi.fn(),
}));

vi.mock('argon2', () => ({
  default: {
    hash: mockArgonHash,
    verify: mockArgonVerify,
    argon2id: 2,
  },
  hash: mockArgonHash,
  verify: mockArgonVerify,
  argon2id: 2,
}));

const { mockHash } = vi.hoisted(() => ({
  mockHash: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  hash: mockHash,
  compare: mockBcryptCompare,
  default: {
    hash: mockHash,
    compare: mockBcryptCompare,
  },
}));

vi.mock('server-only', () => ({}));

import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('hashes a password with argon2id', async () => {
    mockArgonHash.mockResolvedValue('hashed-password');

    const result = await hashPassword('my-secret');

    expect(result).toBe('hashed-password');
    expect(mockArgonHash).toHaveBeenCalledWith(
      'my-secret',
      expect.objectContaining({
        type: 2,
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
      }),
    );
  });

  it('throws a safe error when argon2.hash fails', async () => {
    mockArgonHash.mockRejectedValue(new Error('argon2 oom'));

    await expect(hashPassword('my-secret')).rejects.toThrow('Failed to hash password');
  });

  it('verifies a correct password against an argon2 hash', async () => {
    mockArgonVerify.mockResolvedValue(true);

    const result = await verifyPassword('my-secret', '$argon2id$hashed-password');

    expect(result).toBe(true);
    expect(mockArgonVerify).toHaveBeenCalledWith('$argon2id$hashed-password', 'my-secret');
  });

  it('falls back to bcrypt for legacy hashes', async () => {
    mockBcryptCompare.mockResolvedValue(true);

    const result = await verifyPassword('my-secret', '$2b$12$legacy-hash');

    expect(result).toBe(true);
    expect(mockBcryptCompare).toHaveBeenCalledWith('my-secret', '$2b$12$legacy-hash');
  });

  it('rejects unknown hash formats', async () => {
    const result = await verifyPassword('wrong-secret', 'hashed-password');

    expect(result).toBe(false);
  });

  it('returns false instead of throwing on verify error', async () => {
    mockArgonVerify.mockRejectedValue(new Error('compare failed'));

    const result = await verifyPassword('my-secret', '$argon2id$hashed-password');

    expect(result).toBe(false);
  });
});
