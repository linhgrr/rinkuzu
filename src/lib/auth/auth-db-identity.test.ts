import { describe, expect, it } from 'vitest';

import { selectAuthDbUserId } from '@/lib/auth/auth-db-identity';

describe('selectAuthDbUserId', () => {
  it('requires nonempty dbUserId for Google and ignores core-generated user.id', () => {
    expect(
      selectAuthDbUserId('google', {
        id: '02fb821b-1cad-42a5-ac5c-12d6e4044348',
        dbUserId: '507f191e810c19729de860ea',
      }),
    ).toBe('507f191e810c19729de860ea');

    expect(
      selectAuthDbUserId('google', {
        id: '02fb821b-1cad-42a5-ac5c-12d6e4044348',
      }),
    ).toBeNull();

    expect(selectAuthDbUserId('google', { dbUserId: '   ' })).toBeNull();
  });

  it('requires nonempty user.id for credentials', () => {
    expect(
      selectAuthDbUserId('credentials', {
        id: '507f191e810c19729de860ea',
        dbUserId: 'should-not-win',
      }),
    ).toBe('507f191e810c19729de860ea');

    expect(selectAuthDbUserId('credentials', { dbUserId: 'only-google' })).toBeNull();
    expect(selectAuthDbUserId('credentials', { id: '' })).toBeNull();
  });

  it('fails closed on missing user', () => {
    expect(selectAuthDbUserId('google', null)).toBeNull();
    expect(selectAuthDbUserId('credentials', undefined)).toBeNull();
  });
});
