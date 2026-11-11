import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createFromTextMock } = vi.hoisted(() => ({ createFromTextMock: vi.fn() }));

vi.mock('@/lib/guest-draft-factory', () => ({
  getGuestDraftService: () => ({ createFromText: createFromTextMock }),
}));

import { POST } from '@/app/api/guest-drafts/text/route';

const TOKEN = 'T'.repeat(43);
const NOTES = 'Fake notes about plant cells and their walls. '.repeat(10);
const PROCESSING = {
  status: 'processing',
  progressPercent: 0,
  title: null,
  questionCount: 0,
  failureReason: null,
};

function paste(body: unknown, { token = TOKEN }: { token?: string | null } = {}): NextRequest {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-forwarded-for': '203.0.113.7',
  });
  if (token) headers.set('x-guest-draft-token', token);
  return new NextRequest('http://localhost/api/guest-drafts/text', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const valid = { text: '  ' + NOTES + '  ', locale: 'vi', entry: 'create' };

describe('POST /api/guest-drafts/text (RIN-1538)', () => {
  beforeEach(() => createFromTextMock.mockReset());

  it('creates a text draft with the trimmed text, token, locale, entry and caller IP', async () => {
    createFromTextMock.mockResolvedValue({ ok: true, draft: PROCESSING });

    const response = await POST(paste(valid));

    expect(response.status).toBe(201);
    expect((await response.json()).data).toEqual(PROCESSING);
    expect(createFromTextMock).toHaveBeenCalledWith({
      token: TOKEN,
      text: NOTES.trim(),
      locale: 'vi',
      entry: 'create',
      ip: '203.0.113.7',
    });
  });

  it('422s a text under 200 characters after trimming, before the caps or the API', async () => {
    const response = await POST(paste({ ...valid, text: 'a'.repeat(199) + '      ' }));

    expect(response.status).toBe(422);
    expect((await response.json()).error).toMatchObject({
      code: 'validation_error',
      meta: { reason: 'guest_text_too_short', limit_chars: 200 },
    });
    expect(createFromTextMock).not.toHaveBeenCalled();
  });

  it('counts characters, not UTF-16 units: 200 emoji are long enough', async () => {
    createFromTextMock.mockResolvedValue({ ok: true, draft: PROCESSING });
    const emoji = String.fromCodePoint(0x1f331);
    expect((await POST(paste({ ...valid, text: emoji.repeat(200) }))).status).toBe(201);
  });

  it('413s a text over 20,000 characters', async () => {
    const response = await POST(paste({ ...valid, text: 'a'.repeat(20_001) }));

    expect(response.status).toBe(413);
    expect((await response.json()).error.meta).toEqual({
      reason: 'guest_text_too_long',
      limit_chars: 20_000,
    });
    expect(createFromTextMock).not.toHaveBeenCalled();
  });

  it('413s a body whose declared length is far over the limit without reading it', async () => {
    const request = paste(valid);
    request.headers.set('content-length', String(2 * 1024 * 1024));
    expect((await POST(request)).status).toBe(413);
    expect(createFromTextMock).not.toHaveBeenCalled();
  });

  it.each([
    ['no token', valid, { token: null }],
    ['a bad entry', { ...valid, entry: 'elsewhere' }, {}],
    ['a bad locale', { ...valid, locale: 'fr' }, {}],
    ['no text', { locale: 'vi', entry: 'create' }, {}],
    ['an unknown field', { ...valid, file: 'x' }, {}],
    ['a body that is not JSON', 'not json', {}],
  ])('400s %s', async (_label, body, options) => {
    expect((await POST(paste(body, options))).status).toBe(400);
    expect(createFromTextMock).not.toHaveBeenCalled();
  });

  it('maps a hit cap (shared with PDF drafts) to 429 with the guest_draft_limit reason', async () => {
    createFromTextMock.mockResolvedValue({
      ok: false,
      error: 'limit',
      scope: 'ip',
      retryAfterSeconds: 30,
    });

    const response = await POST(paste(valid));

    expect(response.status).toBe(429);
    expect((await response.json()).error).toMatchObject({
      code: 'rate_limit_exceeded',
      meta: { reason: 'guest_draft_limit', scope: 'ip', retryAfterSeconds: 30 },
    });
  });

  it('409s a token already used by another guest draft', async () => {
    createFromTextMock.mockResolvedValue({ ok: false, error: 'token_in_use' });
    expect((await POST(paste(valid))).status).toBe(409);
  });

  it('forwards the API character limit of a refused text', async () => {
    createFromTextMock.mockResolvedValue({
      ok: false,
      error: 'upstream',
      status: 422,
      code: 'validation_error',
      meta: { reason: 'guest_text_too_short', limit_chars: 200, internal: 'x' },
    });

    const response = await POST(paste(valid));

    expect(response.status).toBe(422);
    expect((await response.json()).error.meta).toEqual({
      reason: 'guest_text_too_short',
      limit_chars: 200,
    });
  });
});
