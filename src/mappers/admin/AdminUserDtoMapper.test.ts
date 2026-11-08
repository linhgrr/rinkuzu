import { describe, expect, it } from 'vitest';
import type { User } from '@/entities/User';
import { AdminUserDtoMapper } from '@/mappers/admin/AdminUserDtoMapper';

const user: User = {
  id: '507f191e810c19729de860ea',
  email: 'learner@example.com',
  displayName: 'Learner',
  role: 'user',
  disable: 0,
  disabledAt: null,
  createdAt: new Date('2026-07-01T00:00:00Z'),
  subscription: {
    planId: 'premium-p1m',
    planName: 'Premium',
    startDate: new Date('2026-07-01T00:00:00Z'),
    endDate: new Date('2026-08-01T00:00:00Z'),
    isActive: true,
  },
};

describe('AdminUserDtoMapper', () => {
  it('maps persistence-style identity and dates to the public DTO', () => {
    expect(AdminUserDtoMapper.toDto(user)).toEqual({
      id: '507f191e810c19729de860ea',
      email: 'learner@example.com',
      displayName: 'Learner',
      role: 'user',
      disable: 0,
      disabledAt: null,
      isTestAccount: false,
      createdAt: '2026-07-01T00:00:00.000Z',
      subscription: {
        plan: { id: 'premium-p1m', name: 'Premium' },
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-08-01T00:00:00.000Z',
        isActive: true,
      },
    });
  });

  it('exposes the admin-set test-account flag', () => {
    expect(AdminUserDtoMapper.toDto({ ...user, isTestAccount: true }).isTestAccount).toBe(true);
  });

  it('does not expose authentication fields or authVersion', () => {
    const dto = AdminUserDtoMapper.toDto(user);
    expect(dto).not.toHaveProperty('password');
    expect(dto).not.toHaveProperty('authVersion');
  });

  it('omits absent optional profile and subscription fields', () => {
    const dto = AdminUserDtoMapper.toDto({
      id: user.id,
      email: user.email,
      role: user.role,
      disable: 0,
      createdAt: user.createdAt,
    });

    expect(dto).not.toHaveProperty('displayName');
    expect(dto).not.toHaveProperty('subscription');
  });

  it('omits absent optional subscription dates', () => {
    const dto = AdminUserDtoMapper.toDto({
      ...user,
      subscription: { planId: 'premium-p1m', planName: 'Premium', isActive: true },
    });

    expect(dto.subscription).toEqual({
      plan: { id: 'premium-p1m', name: 'Premium' },
      isActive: true,
    });
  });

  it('maps status DTO for disable transitions without authVersion', () => {
    const disabled: User = {
      ...user,
      disable: 1,
      disabledAt: new Date('2026-07-10T00:00:00Z'),
    };
    const dto = AdminUserDtoMapper.toStatusDto(disabled, true, 1);
    expect(dto).toMatchObject({
      id: user.id,
      disable: 1,
      changed: true,
      disabledAt: '2026-07-10T00:00:00.000Z',
    });
    expect(dto).not.toHaveProperty('authVersion');
  });
});
