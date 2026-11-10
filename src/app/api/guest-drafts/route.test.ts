import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createMock, statusMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  statusMock: vi.fn(),
}));

vi.mock('@/lib/guest-draft-factory', () => ({
  getGuestDraftService: () => ({ create: createMock, status: statusMock }),
}));

import { POST } from '@/app/api/guest-drafts/route';
import { POST as STATUS } from '@/app/api/guest-drafts/status/route';

const TOKEN = 'T'.repeat(43);
const READY = {
  status: 'ready',
  progressPercent: 100,
  title: 'Cells',
  questionCount: 4,
  failureReason: null,
};

function upload(
  file: File | null,
  { token = TOKEN, entry = 'landing' }: { token?: string | null; entry?: string } = {},
): NextRequest {
  const form = new FormData();
  form.append('locale', 'en');
  form.append('entry', entry);
  if (file) form.append('file', file);
  const headers = new Headers({ 'x-forwarded-for': '203.0.113.7' });
  if (token) headers.set('x-guest-draft-token', token);
  return new NextRequest('http://localhost/api/guest-drafts', {
    method: 'POST',
    headers,
    body: form,
  });
}

const pdfFile = (bytes = 64) =>
  new File(['%PDF-1.4\n', 'x'.repeat(bytes)], 'notes.pdf', { type: 'application/pdf' });

describe('POST /api/guest-drafts', () => {
  beforeEach(() => {
    createMock.mockReset();
    statusMock.mockReset();
  });

  it('creates a draft with the token, locale, entry and caller IP', async () => {
    createMock.mockResolvedValue({ ok: true, draft: { ...READY, status: 'processing' } });

    const response = await POST(upload(pdfFile()));

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: TOKEN, locale: 'en', entry: 'landing', ip: '203.0.113.7' }),
    );
  });

  it('refuses a PDF over 10 MB before the service (no cap, no upstream)', async () => {
    const response = await POST(upload(pdfFile(10 * 1024 * 1024)));

    expect(response.status).toBe(413);
    expect((await response.json()).error.meta).toMatchObject({
      reason: 'guest_pdf_too_large',
      limit_mb: 10,
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('refuses a body whose declared length is far over the limit without reading it', async () => {
    const request = upload(pdfFile());
    request.headers.set('content-length', String(20 * 1024 * 1024));
    expect((await POST(request)).status).toBe(413);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('refuses a file that is not a PDF', async () => {
    const fake = new File(['hello'], 'notes.pdf', { type: 'application/pdf' });
    expect((await POST(upload(fake))).status).toBe(415);
    expect(createMock).not.toHaveBeenCalled();
  });

  it.each([
    ['no token', { token: null }],
    ['a bad entry', { entry: 'elsewhere' }],
  ])('400s %s', async (_label, options) => {
    expect((await POST(upload(pdfFile(), options))).status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('maps a hit cap to 429 with the guest_draft_limit reason', async () => {
    createMock.mockResolvedValue({
      ok: false,
      error: 'limit',
      scope: 'daily',
      retryAfterSeconds: 9,
    });

    const response = await POST(upload(pdfFile()));

    expect(response.status).toBe(429);
    expect((await response.json()).error).toMatchObject({
      code: 'rate_limit_exceeded',
      meta: { reason: 'guest_draft_limit', scope: 'daily', retryAfterSeconds: 9 },
    });
  });

  it('forwards only the API page/size cap fields of a refused upload', async () => {
    createMock.mockResolvedValue({
      ok: false,
      error: 'upstream',
      status: 413,
      code: 'validation_error',
      meta: { reason: 'guest_pdf_too_large', limit_pages: 10, internal: 'x' },
    });

    const response = await POST(upload(pdfFile()));

    expect(response.status).toBe(413);
    expect((await response.json()).error.meta).toEqual({
      reason: 'guest_pdf_too_large',
      limit_pages: 10,
    });
  });

  it('turns an API outage into a retryable 503', async () => {
    createMock.mockResolvedValue({
      ok: false,
      error: 'upstream',
      status: 500,
      code: null,
      meta: null,
    });
    expect((await POST(upload(pdfFile()))).status).toBe(503);
  });
});

describe('POST /api/guest-drafts/status', () => {
  const statusRequest = (body: unknown) =>
    new NextRequest('http://localhost/api/guest-drafts/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
      body: JSON.stringify(body),
    });

  it('returns the draft view for the token in the body', async () => {
    statusMock.mockResolvedValue({ ok: true, draft: READY });

    const response = await STATUS(statusRequest({ token: TOKEN }));

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(READY);
    expect(statusMock).toHaveBeenCalledWith(TOKEN, '203.0.113.7');
  });

  it('404s an unknown token and 400s a malformed one', async () => {
    statusMock.mockResolvedValue({ ok: false, error: 'not_found' });
    expect((await STATUS(statusRequest({ token: TOKEN }))).status).toBe(404);
    expect((await STATUS(statusRequest({ token: 'short' }))).status).toBe(400);
  });
});
