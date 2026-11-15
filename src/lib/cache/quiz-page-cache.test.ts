import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath }));
const warn = vi.hoisted(() => vi.fn());
vi.mock('@/lib/logger', () => ({ logger: { warn } }));

import { revalidateQuizPages } from './quiz-page-cache';

describe('revalidateQuizPages', () => {
  beforeEach(() => {
    revalidatePath.mockReset();
    warn.mockReset();
  });

  const pathsOf = (slug: string) => [
    `/vi/quiz/${slug}`,
    `/vi/signed-out/quiz/${slug}`,
    `/en/quiz/${slug}`,
    `/en/signed-out/quiz/${slug}`,
  ];

  it('revalidates the public and twin path in both locales, once per slug', () => {
    revalidateQuizPages(['old-slug', 'new-slug', 'old-slug']);

    expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      ...pathsOf('old-slug'),
      ...pathsOf('new-slug'),
    ]);
  });

  it('encodes a slug the way the router sees it', () => {
    revalidateQuizPages(['a b']);

    expect(revalidatePath).toHaveBeenCalledWith('/vi/signed-out/quiz/a%20b');
  });

  it('skips missing slugs', () => {
    revalidateQuizPages([undefined, null, '']);

    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('never throws, for example outside a request', () => {
    revalidatePath.mockImplementation(() => {
      throw new Error('Invariant: static generation store missing');
    });

    expect(() => revalidateQuizPages(['a', 'b'])).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
