import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, recordRejectionMock, reserveMock, commitMock, refundMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  recordRejectionMock: vi.fn(),
  reserveMock: vi.fn(),
  commitMock: vi.fn(),
  refundMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/adaptive/config', () => ({
  buildAdaptiveInfraUrl: (path: string) => `https://adaptive.test/api/${path}`,
  buildAdaptiveServiceHeaders: () => ({}),
  buildAdaptiveUrl: (path: string) => `https://adaptive.test/api${path}`,
  resolveAdaptiveProxyTimeoutMs: () => 30_000,
}));
vi.mock('@/lib/upload-counter-factory', () => ({
  getUploadCounterService: () => ({ recordRejection: recordRejectionMock }),
}));
vi.mock('@/lib/llm/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/llm/rate-limit')>()),
  reserveLlmUsage: reserveMock,
  commitLlmUsage: commitMock,
  refundLlmUsage: refundMock,
}));

import { POST } from '@/app/api/quiz-drafts/image/route';

const routeContext = { params: Promise.resolve({}) };
const RESERVATION = {
  allowed: true,
  duplicate: false,
  disposition: 'reserved',
  tier: 'free',
  action: 'quiz_extract',
  windows: [],
};
const fetchMock = vi.fn();

function jpeg(bytes = 64): File {
  const body = new Uint8Array(bytes);
  body.set([0xff, 0xd8, 0xff, 0xe0]);
  return new File([body], 'page.jpg', { type: 'image/jpeg' });
}

function upload(images: File[], title: string | null = 'Fake photo quiz') {
  const form = new FormData();
  if (title) form.append('title', title);
  images.forEach((image) => form.append('images', image));
  return new NextRequest('http://localhost/api/quiz-drafts/image', { method: 'POST', body: form });
}

function envelope(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/quiz-drafts/image', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    authMock.mockResolvedValue({ user: { id: 'user-1', email: 'user@example.com', role: 'user' } });
    reserveMock.mockResolvedValue(RESERVATION);
  });

  it('forwards the photos as multipart and charges one quiz_extract unit on a 201', async () => {
    fetchMock.mockResolvedValue(
      envelope(201, { success: true, data: { draft: { draft_id: 'd1', status: 'queued' } } }),
    );

    const response = await POST(upload([jpeg(), jpeg(), jpeg()]), routeContext);

    expect(response.status).toBe(201);
    expect(reserveMock).toHaveBeenCalledWith('user-1', 'quiz_extract', expect.any(String));
    expect(commitMock).toHaveBeenCalledTimes(1);
    expect(refundMock).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/quiz/drafts/image');
    expect((init.body as FormData).getAll('images')).toHaveLength(3);
    expect((init.body as FormData).get('title')).toBe('Fake photo quiz');
  });

  it.each([
    [
      422,
      { error: { code: 'too_little_text', message: 'x', meta: { reason: 'too_little_text' } } },
    ],
    [400, { error: { code: 'validation_error', message: 'x' } }],
    [503, { error: { code: 'service_unavailable', message: 'x' } }],
  ])('charges nothing on a %s from the API', async (status, body) => {
    fetchMock.mockResolvedValue(envelope(status, { success: false, ...body }));

    const response = await POST(upload([jpeg()]), routeContext);

    expect(response.status).toBe(status);
    expect(refundMock).toHaveBeenCalledTimes(1);
    expect(commitMock).not.toHaveBeenCalled();
  });

  it('counts a too_little_text refusal on the create_photo surface', async () => {
    fetchMock.mockResolvedValue(
      envelope(422, { success: false, error: { code: 'too_little_text', message: 'x' } }),
    );

    await POST(upload([jpeg()]), routeContext);

    expect(recordRejectionMock).toHaveBeenCalledWith(
      expect.objectContaining({ surface: 'create_photo', reason: 'too_little_text' }),
    );
  });

  it.each([
    ['6 parts', () => Array.from({ length: 6 }, () => jpeg()), 'too_many_images'],
    [
      'a non-JPEG part',
      () => [new File(['x'], 'a.png', { type: 'image/png' })],
      'image_unsupported',
    ],
    ['a 1.2 MB part', () => [jpeg(1_258_291)], 'image_too_large'],
    ['4.5 MB in total', () => Array.from({ length: 5 }, () => jpeg(945_000)), 'image_too_large'],
  ])('refuses %s with no upstream call and no reservation', async (_name, files, reason) => {
    const response = await POST(upload(files()), routeContext);

    expect([400, 413, 415]).toContain(response.status);
    expect((await response.json()).error.meta).toMatchObject({ reason });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(reserveMock).not.toHaveBeenCalled();
    expect(recordRejectionMock).toHaveBeenCalledWith(
      expect.objectContaining({ surface: 'create_photo' }),
    );
  });

  it('refuses a missing title before the API', async () => {
    const response = await POST(upload([jpeg()], null), routeContext);

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
