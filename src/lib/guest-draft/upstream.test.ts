import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/adaptive/config', () => ({
  buildAdaptiveUrl: (path: string) => `http://api.test/api${path}`,
  buildAdaptiveServiceHeaders: () => ({ 'x-service-token': 'fake-service-token' }),
  resolveAdaptiveProxyTimeoutMs: () => 1_000,
}));
const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { warn } }));

import { createGuestDraftUpstream } from '@/lib/guest-draft/upstream';

const draft = { draft_id: 'api-draft-1', status: 'queued', progress: { percent: 0 } };
const fetchMock = vi.fn<typeof fetch>();

function respond(status: number, body: unknown): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createGuestDraftUpstream', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('creates with the service token only and returns the draft', async () => {
    fetchMock.mockResolvedValue(respond(201, { success: true, data: { draft } }));

    const result = await createGuestDraftUpstream().create(new Blob(['%PDF-']));

    expect(result).toEqual({ ok: true, draft });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://api.test/api/quiz/guest-drafts');
    expect(init?.method).toBe('POST');
    expect(init?.headers).not.toHaveProperty('x-user-id');
    expect(init?.body).toBeInstanceOf(FormData);
  });

  it('returns the API status, code and meta when it refuses', async () => {
    fetchMock.mockResolvedValue(
      respond(413, {
        error: { code: 'validation_error', meta: { reason: 'guest_pdf_too_large' } },
      }),
    );
    expect(await createGuestDraftUpstream().create(new Blob(['x']))).toEqual({
      ok: false,
      status: 413,
      code: 'validation_error',
      meta: { reason: 'guest_pdf_too_large' },
    });
  });

  it('treats a 2xx without a draft, or a non-JSON body, as an upstream error', async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { data: {} }));
    expect(await createGuestDraftUpstream().get('api-draft-1')).toEqual({
      ok: false,
      status: 502,
      code: null,
      meta: null,
    });
    fetchMock.mockResolvedValueOnce(respond(500, '<html>'));
    expect(await createGuestDraftUpstream().get('api-draft-1')).toMatchObject({ status: 500 });
  });

  it('reads and deletes by encoded draft id; a network error is a 503, a lost delete is ignored', async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { data: { draft } }));
    await createGuestDraftUpstream().get('a/b');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://api.test/api/quiz/guest-drafts/a%2Fb');

    fetchMock.mockRejectedValueOnce(new TypeError('network'));
    expect(await createGuestDraftUpstream().get('x')).toMatchObject({ ok: false, status: 503 });
    fetchMock.mockRejectedValueOnce(new TypeError('network'));
    expect(await createGuestDraftUpstream().create(new Blob(['x']))).toMatchObject({ status: 503 });

    fetchMock.mockResolvedValueOnce(respond(500, {}));
    await expect(createGuestDraftUpstream().remove('x')).resolves.toBeUndefined();
    fetchMock.mockRejectedValueOnce(new TypeError('network'));
    await expect(createGuestDraftUpstream().remove('x')).resolves.toBeUndefined();
    fetchMock.mockResolvedValueOnce(respond(200, {}));
    await createGuestDraftUpstream().remove('x');
    expect(fetchMock.mock.calls.at(-1)?.[1]?.method).toBe('DELETE');
  });

  it('creates from pasted text as JSON to the text route, service token only (RIN-1538)', async () => {
    fetchMock.mockResolvedValue(respond(201, { success: true, data: { draft } }));

    const result = await createGuestDraftUpstream().createFromText('Fake pasted notes');

    expect(result).toEqual({ ok: true, draft });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://api.test/api/quiz/guest-drafts/text');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ text: 'Fake pasted notes' }));
    expect(init?.headers).toMatchObject({
      'x-service-token': 'fake-service-token',
      'content-type': 'application/json',
    });
    expect(init?.headers).not.toHaveProperty('x-user-id');
  });

  it('returns the API refusal of a text, and never logs the text on a network error', async () => {
    fetchMock.mockResolvedValueOnce(
      respond(413, {
        error: {
          code: 'validation_error',
          meta: { reason: 'guest_text_too_long', limit_chars: 20000 },
        },
      }),
    );
    expect(await createGuestDraftUpstream().createFromText('x')).toEqual({
      ok: false,
      status: 413,
      code: 'validation_error',
      meta: { reason: 'guest_text_too_long', limit_chars: 20000 },
    });

    warn.mockClear();
    fetchMock.mockRejectedValueOnce(new TypeError('network'));
    expect(await createGuestDraftUpstream().createFromText('Fake secret notes')).toMatchObject({
      status: 503,
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('Fake secret notes');
  });
});
