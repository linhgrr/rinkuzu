import { describe, expect, it } from 'vitest';
import {
  adminUserIdRouteParamsSchema,
  adminUserListQuerySchema,
  updateAdminUserRoleRequestSchema,
  updateAdminUserStatusRequestSchema,
} from '@/dtos/admin-user';

const userId = '507f191e810c19729de860ea';

describe('admin user controller schemas', () => {
  it('normalizes list query parameters including status filter', () => {
    expect(
      adminUserListQuerySchema.parse({
        page: '2',
        limit: '25',
        search: '  learner@example.com  ',
        role: 'user',
        status: 'disabled',
      }),
    ).toEqual({
      page: 2,
      limit: 25,
      search: 'learner@example.com',
      role: 'user',
      status: 'disabled',
    });

    expect(adminUserListQuerySchema.parse({})).toMatchObject({
      page: 1,
      limit: 10,
      status: 'all',
    });
  });

  it('rejects invalid list, role update, and status inputs', () => {
    expect(adminUserListQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(adminUserListQuerySchema.safeParse({ status: 'deleted' }).success).toBe(false);
    expect(updateAdminUserRoleRequestSchema.safeParse({ userId, role: 'owner' }).success).toBe(
      false,
    );
    expect(updateAdminUserStatusRequestSchema.safeParse({ disable: 2 }).success).toBe(false);
    expect(updateAdminUserStatusRequestSchema.safeParse({ disable: '0' }).success).toBe(false);
    expect(adminUserIdRouteParamsSchema.safeParse({ userId: 'not-an-id' }).success).toBe(false);
  });

  it('accepts exact role and status contracts', () => {
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

    expect(updateAdminUserStatusRequestSchema.parse({ disable: 0 })).toEqual({ disable: 0 });
    expect(updateAdminUserStatusRequestSchema.parse({ disable: 1 })).toEqual({ disable: 1 });
    expect(updateAdminUserStatusRequestSchema.safeParse({ disable: 1, extra: true }).success).toBe(
      false,
    );
    expect(adminUserIdRouteParamsSchema.parse({ userId })).toEqual({ userId });
  });
});
