import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { AdminUserIdentityService } from '@/services/admin/AdminUserIdentityService';
import type { IUserIdentityRepository } from '@/interfaces/repositories/IUserIdentityRepository';

function service(findByNameOrEmail: IUserIdentityRepository['findByNameOrEmail']) {
  const repository: IUserIdentityRepository = { findByNameOrEmail };
  return { repository, subject: new AdminUserIdentityService(repository) };
}

describe('AdminUserIdentityService.searchLearners', () => {
  it('returns allowlisted identities, capped at 20', async () => {
    const { repository, subject } = service(
      vi.fn().mockResolvedValue([
        { id: 'user-a', email: 'a@example.com', displayName: 'A' },
        { id: 'user-b', email: 'b@example.com' },
      ]),
    );

    await expect(subject.searchLearners('example')).resolves.toEqual({
      success: true,
      data: {
        learners: [
          { id: 'user-a', displayName: 'A', email: 'a@example.com' },
          { id: 'user-b', displayName: null, email: 'b@example.com' },
        ],
      },
    });
    expect(repository.findByNameOrEmail).toHaveBeenCalledWith('example', 20);
  });

  it('drops any extra field a repository might return', async () => {
    const { subject } = service(
      vi
        .fn()
        .mockResolvedValue([
          { id: 'user-a', email: 'a@example.com', password: 'hash', role: 'admin' },
        ]),
    );

    const result = await subject.searchLearners('a@');

    expect(result.success && result.data.learners[0]).toEqual({
      id: 'user-a',
      displayName: null,
      email: 'a@example.com',
    });
  });

  it('returns an empty list when nothing matches', async () => {
    const { subject } = service(vi.fn().mockResolvedValue([]));

    await expect(subject.searchLearners('nobody')).resolves.toEqual({
      success: true,
      data: { learners: [] },
    });
  });

  it('reports a lookup failure instead of pretending nothing matched', async () => {
    const { subject } = service(vi.fn().mockRejectedValue(new Error('db down')));

    await expect(subject.searchLearners('linh')).resolves.toEqual({
      success: false,
      error: 'Failed to search learners',
      statusCode: 500,
    });
  });
});
