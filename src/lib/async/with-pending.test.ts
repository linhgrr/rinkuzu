import { describe, expect, it, vi } from 'vitest';
import { withPending } from './with-pending';

describe('withPending', () => {
  it('raises the flag while the action runs and lowers it after it resolves', async () => {
    const setPending = vi.fn();
    const action = vi.fn(async () => {
      expect(setPending).toHaveBeenLastCalledWith(true);
      return 'done';
    });

    await expect(withPending(setPending, action)).resolves.toBe('done');
    expect(setPending.mock.calls).toEqual([[true], [false]]);
  });

  it('lowers the flag when the action rejects and passes the rejection on', async () => {
    const setPending = vi.fn();
    const failure = new Error('network down');

    await expect(withPending(setPending, () => Promise.reject(failure))).rejects.toBe(failure);
    expect(setPending.mock.calls).toEqual([[true], [false]]);
  });

  it('lowers the flag when the action throws before returning a promise', async () => {
    const setPending = vi.fn();

    await expect(
      withPending(setPending, () => {
        throw new Error('bad input');
      }),
    ).rejects.toThrow('bad input');
    expect(setPending.mock.calls).toEqual([[true], [false]]);
  });
});
