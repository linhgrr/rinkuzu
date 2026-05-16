import { describe, expect, it } from 'vitest';

import { apiOk } from '@/lib/api/response';

describe('apiOk', () => {
  it('preserves the standard success envelope', async () => {
    const response = apiOk({ id: 'plan-1' }, 201, { meta: { message: 'created' } });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { id: 'plan-1' },
      meta: { message: 'created' },
    });
  });

  it('passes custom headers through without changing the envelope', async () => {
    const response = apiOk({ isPremium: true }, 200, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });

    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { isPremium: true },
    });
  });
});
