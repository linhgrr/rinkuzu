import { describe, expect, it, vi } from 'vitest';

import { cn, generateSlug } from './utils';

describe('utils', () => {
  it('generates a slug with a deterministic suffix shape', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1714201234567);

    expect(generateSlug('Hello World!')).toBe('hello-world-234567');
  });

  it('merges class names with tailwind precedence', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });
});
