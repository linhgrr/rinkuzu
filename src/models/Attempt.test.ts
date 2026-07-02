import { describe, expect, it } from 'vitest';
import Attempt from '@/models/Attempt';

const submission = {
  quiz: '507f191e810c19729de860ea',
  score: 100,
  totalQuestions: 1,
  answers: [{ kind: 'single', selectedIndex: 0 }],
};

describe('Attempt model identity', () => {
  it('casts a registered user ID to ObjectId', async () => {
    const attempt = new Attempt({
      ...submission,
      user: '507f191e810c19729de860eb',
    });

    await expect(attempt.validate()).resolves.toBeUndefined();
    expect(attempt.user?.constructor.name).toBe('ObjectId');
    expect(attempt.guestEmail).toBeUndefined();
  });

  it('accepts a guest email without a user ID', async () => {
    const attempt = new Attempt({
      ...submission,
      guestEmail: 'Guest@Example.com',
    });

    await expect(attempt.validate()).resolves.toBeUndefined();
    expect(attempt.guestEmail).toBe('guest@example.com');
    expect(attempt.user).toBeUndefined();
  });

  it('rejects missing or conflicting identities', async () => {
    const missingIdentity = new Attempt(submission);
    const conflictingIdentity = new Attempt({
      ...submission,
      user: '507f191e810c19729de860eb',
      guestEmail: 'guest@example.com',
    });

    await expect(missingIdentity.validate()).rejects.toThrow(
      'Exactly one attempt identity is required',
    );
    await expect(conflictingIdentity.validate()).rejects.toThrow(
      'Exactly one attempt identity is required',
    );
  });
});
