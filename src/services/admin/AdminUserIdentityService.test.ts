import { describe, expect, it, vi } from 'vitest';
import { AdminUserIdentityService } from '@/services/admin/AdminUserIdentityService';
import type { IUserIdentityRepository } from '@/interfaces/repositories/IUserIdentityRepository';

function service(overrides: Partial<IUserIdentityRepository> = {}) {
  const repository: IUserIdentityRepository = {
    findIdentitiesByIds: vi.fn().mockResolvedValue([]),
    findIdsByNameOrEmail: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
  return { repository, service: new AdminUserIdentityService(repository) };
}

describe('AdminUserIdentityService', () => {
  it('keys identities by user id and skips the repository for an empty list', async () => {
    const { repository, service: subject } = service({
      findIdentitiesByIds: vi
        .fn()
        .mockResolvedValue([{ id: 'user-a', email: 'a@example.com', displayName: 'A' }]),
    });

    await expect(subject.getUserIdentities(['user-a'])).resolves.toEqual(
      new Map([['user-a', { id: 'user-a', email: 'a@example.com', displayName: 'A' }]]),
    );
    await expect(subject.getUserIdentities([])).resolves.toEqual(new Map());
    expect(repository.findIdentitiesByIds).toHaveBeenCalledTimes(1);
  });

  it('degrades to unlabelled rows when the lookup fails', async () => {
    const { service: subject } = service({
      findIdentitiesByIds: vi.fn().mockRejectedValue(new Error('db down')),
      findIdsByNameOrEmail: vi.fn().mockRejectedValue(new Error('db down')),
    });

    await expect(subject.getUserIdentities(['user-a'])).resolves.toEqual(new Map());
    await expect(subject.findUserIdsByNameOrEmail('linh', 100)).resolves.toEqual([]);
  });

  it('passes the search term and cap straight through', async () => {
    const { repository, service: subject } = service({
      findIdsByNameOrEmail: vi.fn().mockResolvedValue(['user-a']),
    });

    await expect(subject.findUserIdsByNameOrEmail('linh', 100)).resolves.toEqual(['user-a']);
    expect(repository.findIdsByNameOrEmail).toHaveBeenCalledWith('linh', 100);
  });
});
