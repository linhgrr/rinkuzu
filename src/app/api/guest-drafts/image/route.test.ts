import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createFromImagesMock, recordRejectionMock } = vi.hoisted(() => ({
  createFromImagesMock: vi.fn(),
  recordRejectionMock: vi.fn(),
}));

vi.mock('@/lib/guest-draft-factory', () => ({
  getGuestDraftService: () => ({ createFromImages: createFromImagesMock }),
}));
vi.mock('@/lib/upload-counter-factory', () => ({
  getUploadCounterService: () => ({ recordRejection: recordRejectionMock }),
}));

import { POST } from '@/app/api/guest-drafts/image/route';

const TOKEN = 'T'.repeat(43);
const PROCESSING = {
  status: 'processing',
  progressPercent: 0,
  title: null,
  questionCount: 0,
  complete: false,
  completion: null,
  failureReason: null,
};

function jpeg(bytes = 64, type = 'image/jpeg'): File {
  const body = new Uint8Array(bytes);
  body.set([0xff, 0xd8, 0xff, 0xe0]);
  return new File([body], 'page.jpg', { type });
}

function upload(images: File[], { token = TOKEN as string | null, entry = 'try_photo' } = {}) {
  const form = new FormData();
  form.append('locale', 'vi');
  form.append('entry', entry);
  images.forEach((image) => form.append('images', image));
  const headers = new Headers({ 'x-forwarded-for': '203.0.113.7' });
  if (token) headers.set('x-guest-draft-token', token);
  return new NextRequest('http://localhost/api/guest-drafts/image', {
    method: 'POST',
    headers,
    body: form,
  });
}

describe('POST /api/guest-drafts/image', () => {
  beforeEach(() => {
    createFromImagesMock.mockReset();
    recordRejectionMock.mockReset();
  });

  it('creates a draft from 3 JPEG parts with the token, locale, entry and caller IP', async () => {
    createFromImagesMock.mockResolvedValue({ ok: true, draft: PROCESSING });

    const response = await POST(upload([jpeg(), jpeg(), jpeg()]));

    expect(response.status).toBe(201);
    expect(createFromImagesMock).toHaveBeenCalledTimes(1);
    const input = createFromImagesMock.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      token: TOKEN,
      locale: 'vi',
      entry: 'try_photo',
      ip: '203.0.113.7',
    });
    expect(input.images).toHaveLength(3);
    expect(recordRejectionMock).not.toHaveBeenCalled();
  });

  it.each([
    ['6 parts', () => Array.from({ length: 6 }, () => jpeg()), 400, 'too_many_images'],
    ['a PNG part', () => [jpeg(), jpeg(64, 'image/png')], 415, 'image_unsupported'],
    [
      'a part with a JPEG type but other bytes',
      () => [new File(['nope'], 'a.jpg', { type: 'image/jpeg' })],
      415,
      'image_unsupported',
    ],
    ['a 1.2 MB part', () => [jpeg(1_258_291)], 413, 'image_too_large'],
    [
      '4.5 MB in total',
      () => Array.from({ length: 5 }, () => jpeg(945_000)),
      413,
      'image_too_large',
    ],
  ])('refuses %s before the service and counts it', async (_name, files, status, reason) => {
    const response = await POST(upload(files()));

    expect(response.status).toBe(status);
    expect((await response.json()).error.meta).toMatchObject({ reason });
    expect(createFromImagesMock).not.toHaveBeenCalled();
    expect(recordRejectionMock).toHaveBeenCalledTimes(1);
    expect(recordRejectionMock).toHaveBeenCalledWith(
      expect.objectContaining({ surface: 'try_photo', ext: 'jpg' }),
    );
  });

  it('refuses a request with no photos and a missing token', async () => {
    expect((await POST(upload([]))).status).toBe(400);
    expect((await POST(upload([jpeg()], { token: null }))).status).toBe(400);
    expect(createFromImagesMock).not.toHaveBeenCalled();
  });

  it('passes a 422 too_little_text through with the API reason and counts the refusal', async () => {
    createFromImagesMock.mockResolvedValue({
      ok: false,
      error: 'upstream',
      status: 422,
      code: 'too_little_text',
      meta: { reason: 'too_little_text' },
    });

    const response = await POST(upload([jpeg()]));

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe('too_little_text');
    expect(body.error.meta).toMatchObject({ reason: 'too_little_text' });
    expect(recordRejectionMock).toHaveBeenCalledWith(
      expect.objectContaining({ surface: 'try_photo', reason: 'too_little_text' }),
    );
  });

  it('answers 503 service_unavailable when the API is off or down', async () => {
    createFromImagesMock.mockResolvedValue({
      ok: false,
      error: 'upstream',
      status: 503,
      code: 'service_unavailable',
      meta: null,
    });

    const response = await POST(upload([jpeg()]));

    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('service_unavailable');
  });

  it('answers 429 with the guest limit reason when a cap is hit', async () => {
    createFromImagesMock.mockResolvedValue({
      ok: false,
      error: 'limit',
      scope: 'ip',
      retryAfterSeconds: 60,
    });

    const response = await POST(upload([jpeg()]));

    expect(response.status).toBe(429);
    expect((await response.json()).error.meta).toMatchObject({ reason: 'guest_draft_limit' });
  });
});
