import { describe, expect, it, vi } from 'vitest';

const { mockHash, mockCompare } = vi.hoisted(() => ({
  mockHash: vi.fn(),
  mockCompare: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  hash: mockHash,
  compare: mockCompare,
  default: {
    hash: mockHash,
    compare: mockCompare,
  },
}));

import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('hashes a password with 12 salt rounds', async () => {
    mockHash.mockResolvedValue('hashed-password');

    const result = await hashPassword('my-secret');

    expect(result).toBe('hashed-password');
    expect(mockHash).toHaveBeenCalledWith('my-secret', 12);
  });

  it('throws a safe error when bcrypt.hash fails', async () => {
    mockHash.mockRejectedValue(new Error('bcrypt oom'));

    await expect(hashPassword('my-secret')).rejects.toThrow('Failed to hash password');
  });

  it('verifies a correct password against its hash', async () => {
    mockCompare.mockResolvedValue(true);

    const result = await verifyPassword('my-secret', 'hashed-password');

    expect(result).toBe(true);
    expect(mockCompare).toHaveBeenCalledWith('my-secret', 'hashed-password');
  });

  it('rejects an incorrect password', async () => {
    mockCompare.mockResolvedValue(false);

    const result = await verifyPassword('wrong-secret', 'hashed-password');

    expect(result).toBe(false);
  });

  it('returns false instead of throwing on bcrypt.compare error', async () => {
    mockCompare.mockRejectedValue(new Error('compare failed'));

    const result = await verifyPassword('my-secret', 'hashed-password');

    expect(result).toBe(false);
  });
});
