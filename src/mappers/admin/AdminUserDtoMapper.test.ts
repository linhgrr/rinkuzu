import { describe, expect, it } from 'vitest';
import type { User } from '@/entities/User';
import { AdminUserDtoMapper } from '@/mappers/admin/AdminUserDtoMapper';

const user: User = {
  id: '507f191e810c19729de860ea',
  email: 'learner@example.com',
  displayName: 'Learner',
  role: 'user',
  createdAt: new Date('2026-07-01T00:00:00Z'),
  subscription: {
    type: 'premium-p1m',
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
      createdAt: '2026-07-01T00:00:00.000Z',
      subscription: {
        type: 'premium-p1m',
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-08-01T00:00:00.000Z',
        isActive: true,
      },
    });
  });

  it('does not expose authentication fields', () => {
    expect(AdminUserDtoMapper.toDto(user)).not.toHaveProperty('password');
  });

  it('omits absent optional profile and subscription fields', () => {
    const dto = AdminUserDtoMapper.toDto({
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    });

    expect(dto).not.toHaveProperty('displayName');
    expect(dto).not.toHaveProperty('subscription');
  });

  it('omits absent optional subscription dates', () => {
    const dto = AdminUserDtoMapper.toDto({
      ...user,
      subscription: { type: 'lifetime', isActive: true },
    });

    expect(dto.subscription).toEqual({ type: 'lifetime', isActive: true });
  });
});
