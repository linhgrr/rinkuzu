import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerErrorMock, parseNekosApiImageUrlsMock } = vi.hoisted(() => ({
  loggerErrorMock: vi.fn(),
  parseNekosApiImageUrlsMock: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock },
}));

vi.mock('@/lib/integrations/nekos-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/integrations/nekos-api')>(
    '@/lib/integrations/nekos-api',
  );
  return {
    ...actual,
    parseNekosApiImageUrls: parseNekosApiImageUrlsMock,
  };
});

import { NekosApiContractError } from '@/lib/integrations/nekos-api';
import { dynamic, GET } from '@/app/api/adaptive/library-images/route';

function request(query = ''): Request {
  return new Request(`http://localhost/api/adaptive/library-images${query}`);
}

describe('GET /api/adaptive/library-images', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    parseNekosApiImageUrlsMock.mockReturnValue(['https://img.example/a.jpg']);
  });

  it('exports force-dynamic', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('rejects invalid limit query values without fetching upstream', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(request('?limit=0'));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('validation_error');
    expect(body.error.meta?.fields).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches safe-rated images with the default limit and returns parsed urls', async () => {
    const payload = [{ url: 'https://img.example/a.jpg' }];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    parseNekosApiImageUrlsMock.mockReturnValue(['https://img.example/a.jpg']);

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { images: ['https://img.example/a.jpg'] },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.nekosapi.com/v4/images/random?rating=safe&limit=12',
      expect.objectContaining({
        cache: 'no-store',
        redirect: 'manual',
        headers: { accept: 'application/json' },
      }),
    );
    expect(parseNekosApiImageUrlsMock).toHaveBeenCalledWith(payload);
  });

  it('applies validated custom limits to the upstream query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    parseNekosApiImageUrlsMock.mockReturnValue([]);

    await GET(request('?limit=3'));

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.nekosapi.com/v4/images/random?rating=safe&limit=3',
      expect.any(Object),
    );
  });

  it('maps redirect upstream statuses to 502 instead of reflecting 3xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: '/x' } })),
    );

    const response = await GET(request());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'upstream_error',
        detail: 'Failed to fetch library images from upstream service',
      },
    });
    expect(parseNekosApiImageUrlsMock).not.toHaveBeenCalled();
  });

  it('forwards non-redirect upstream error statuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 503 })));

    const response = await GET(request());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'upstream_error' },
    });
  });

  it('maps NekosApiContractError to a 502 upstream_error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ bad: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    parseNekosApiImageUrlsMock.mockImplementation(() => {
      throw new NekosApiContractError();
    });

    const response = await GET(request());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'upstream_error',
        detail: 'NekosAPI returned an invalid image list',
      },
    });
    expect(loggerErrorMock).toHaveBeenCalled();
  });

  it('maps unexpected failures to a safe 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const response = await GET(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'upstream_error',
        detail: 'Failed to fetch random library images',
      },
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Failed to fetch random library images',
    );
  });
});
