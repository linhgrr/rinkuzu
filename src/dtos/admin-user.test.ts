import { describe, expect, it } from 'vitest';
import {
  adminUserListQuerySchema,
  deleteAdminUserQuerySchema,
  updateAdminUserRoleRequestSchema,
} from '@/dtos/admin-user';

const userId = '507f191e810c19729de860ea';

describe('admin user controller schemas', () => {
  it('normalizes list query parameters', () => {
    expect(
      adminUserListQuerySchema.parse({
        page: '2',
        limit: '25',
        search: '  learner@example.com  ',
        role: 'user',
      }),
    ).toEqual({
      page: 2,
      limit: 25,
      search: 'learner@example.com',
      role: 'user',
    });
  });

  it('rejects invalid list, role update, and delete inputs', () => {
    expect(adminUserListQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(updateAdminUserRoleRequestSchema.safeParse({ userId, role: 'owner' }).success).toBe(
      false,
    );
    expect(deleteAdminUserQuerySchema.safeParse({ userId: 'not-an-id' }).success).toBe(false);
  });

  it('accepts the exact role update contract', () => {
    expect(updateAdminUserRoleRequestSchema.parse({ userId, role: 'admin' })).toEqual({
      userId,
      role: 'admin',
    });
    expect(
      updateAdminUserRoleRequestSchema.safeParse({
        userId,
        role: 'admin',
        ignored: true,
      }).success,
    ).toBe(false);
  });
});
