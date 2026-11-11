import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, proxyMock } = vi.hoisted(() => ({ authMock: vi.fn(), proxyMock: vi.fn() }));
const jobLink = vi.hoisted(() => vi.fn());

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/adaptive/proxy', () => ({ proxyAdaptiveRequest: proxyMock }));
vi.mock('@/lib/quiz/draft-usage', () => ({ quizDraftJobLinkFromEnvelope: jobLink }));

import { POST } from '@/app/api/quiz-drafts/text/route';

const routeContext = { params: Promise.resolve({}) };
const NOTES = 'Fake lecture notes on the French revolution and its causes. '.repeat(5);

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/quiz-drafts/text', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/quiz-drafts/text (RIN-1538)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
    proxyMock.mockResolvedValue(new Response(null, { status: 201 }));
  });

  it('forwards the validated body to the API text route, metered as quiz_extract', async () => {
    const body = {
      title: ' Revolution ',
      text: '\n' + NOTES + '\n',
      description: 'Fake description',
      category_id: '6730a0000000000000000001',
      prompt: null,
      submit_to_premium: false,
    };
    const req = request(body);

    const response = await POST(req, routeContext);

    expect(response.status).toBe(201);
    expect(proxyMock).toHaveBeenCalledWith(
      req,
      '/quiz/drafts/text',
      { userId: 'user-1', userRole: 'user' },
      {
        method: 'POST',
        body: JSON.stringify({ ...body, title: 'Revolution', text: NOTES.trim() }),
        contentType: 'application/json',
        llmAction: 'quiz_extract',
        llmJobLink: jobLink,
      },
    );
  });

  it('422s a text under 200 characters without calling the API', async () => {
    const response = await POST(request({ title: 'T', text: 'too short' }), routeContext);

    expect(response.status).toBe(422);
    expect((await response.json()).error).toMatchObject({
      code: 'validation_error',
      meta: { reason: 'text_too_short', limit_chars: 200 },
    });
    expect(proxyMock).not.toHaveBeenCalled();
  });

  it('413s a text over 20,000 characters without calling the API', async () => {
    const response = await POST(request({ title: 'T', text: 'a'.repeat(20_001) }), routeContext);

    expect(response.status).toBe(413);
    expect((await response.json()).error.meta).toEqual({
      reason: 'text_too_long',
      limit_chars: 20_000,
    });
    expect(proxyMock).not.toHaveBeenCalled();
  });

  it.each([
    ['no title', { text: NOTES }],
    ['a bad folder id', { title: 'T', text: NOTES, category_id: 'nope' }],
    ['a PDF field (it belongs on /api/quiz-drafts)', { title: 'T', text: NOTES, s3_key: 'k' }],
    ['a body that is not JSON', 'not json'],
  ])('400s %s', async (_label, body) => {
    expect((await POST(request(body), routeContext)).status).toBe(400);
    expect(proxyMock).not.toHaveBeenCalled();
  });

  it('401s a signed-out caller', async () => {
    authMock.mockResolvedValue(null);
    expect((await POST(request({ title: 'T', text: NOTES }), routeContext)).status).toBe(401);
    expect(proxyMock).not.toHaveBeenCalled();
  });
});
