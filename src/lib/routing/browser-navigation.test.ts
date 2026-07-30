import { describe, expect, it, vi } from 'vitest';

import { replaceBrowserLocation } from '@/lib/routing/browser-navigation';

describe('replaceBrowserLocation', () => {
  it('performs one hard navigation to the validated URL', () => {
    const replace = vi.fn();

    replaceBrowserLocation('/en/dashboard?from=login', { replace });

    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith('/en/dashboard?from=login');
  });
});
