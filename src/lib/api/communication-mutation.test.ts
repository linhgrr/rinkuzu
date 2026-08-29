import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));

import { completeFeedbackSchema } from '@/dtos/communication';
import { withCommunicationMutation } from '@/lib/api/communication-mutation';
import { CommunicationError } from '@/lib/communication/internal';

const ORIGIN = 'http://localhost';
const VALID_ID = '507f191e810c19729de860ea';
const BODY = { revision: 3 };

function adminSession(role = 'admin') {
  return { user: { id: 'admin-1', email: 'ops@example.test', role } };
}

function mutationRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`${ORIGIN}/api/admin/test-communication-mutation`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: ORIGIN,
      'sec-fetch-site': 'same-origin',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const routeContext = { params: Promise.resolve({ id: VALID_ID }) };

const runMock = vi.fn();
const POST = withCommunicationMutation(
  completeFeedbackSchema,
  'test-communication-mutation',
  runMock,
);

/**
 * These routes are a hand on someone's inbox: an admin session, the
 * same-origin JSON guard, a body and route id that both parse, and the
 * operator's identity riding into the write all have to hold before this
 * fires. These tests are that wrapper's contract, exercised directly against
 * a stub domain callback and real schemas.
 */
describe('withCommunicationMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession());
    runMock.mockResolvedValue({ id: VALID_ID, status: 'completed' });
  });

  it("carries the operator's identity into the call it protects", async () => {
    const response = await POST(mutationRequest(BODY), routeContext);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { id: VALID_ID, status: 'completed' },
    });
    expect(runMock).toHaveBeenCalledWith(VALID_ID, BODY, {
      id: 'admin-1',
      email: 'ops@example.test',
    });
  });

  it('is closed to anyone who is not an admin', async () => {
    authMock.mockResolvedValue(adminSession('user'));

    const response = await POST(mutationRequest(BODY), routeContext);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'forbidden' } });
    expect(runMock).not.toHaveBeenCalled();
  });

  it('is closed to a session that never authenticated at all', async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(mutationRequest(BODY), routeContext);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'unauthorized' } });
    expect(runMock).not.toHaveBeenCalled();
  });

  it('refuses a cross-origin request before the body is ever parsed', async () => {
    const response = await POST(
      mutationRequest(BODY, { origin: 'https://evil.test' }),
      routeContext,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'forbidden' } });
    expect(runMock).not.toHaveBeenCalled();
  });

  it("refuses the wrong content type before it ever tries to parse what's in the body", async () => {
    // A body that is not valid JSON, so a wrapper that parsed before guarding
    // would fail on the JSON parse (400) instead of the media-type guard (415).
    const request = new NextRequest(`${ORIGIN}/api/admin/test-communication-mutation`, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        origin: ORIGIN,
        'sec-fetch-site': 'same-origin',
      },
      body: 'this is not json',
    });

    const response = await POST(request, routeContext);

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'unsupported_media_type' },
    });
    expect(runMock).not.toHaveBeenCalled();
  });

  it('rejects a body that fails its schema without ever reaching the domain call, and says which field', async () => {
    const response = await POST(mutationRequest({ revision: -1 }), routeContext);

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe('validation_error');
    expect(payload.error.meta.fields).toHaveProperty('revision');
    expect(runMock).not.toHaveBeenCalled();
  });

  it('refuses a malformed id before it ever reaches the body', async () => {
    const response = await POST(mutationRequest(BODY), {
      params: Promise.resolve({ id: 'not-a-valid-id' }),
    });

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe('validation_error');
    expect(payload.error.meta.fields).toHaveProperty('id');
    expect(runMock).not.toHaveBeenCalled();
  });

  it('passes a domain refusal through with the status it earned, not a flattened 500', async () => {
    runMock.mockRejectedValueOnce(
      new CommunicationError(
        'feedback_already_completed',
        'This feedback conversation is already completed',
        409,
      ),
    );

    const response = await POST(mutationRequest(BODY), routeContext);

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.error.code).toBe('feedback_already_completed');
  });
});
