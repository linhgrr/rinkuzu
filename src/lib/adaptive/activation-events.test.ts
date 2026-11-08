import { beforeEach, describe, expect, it, vi } from 'vitest';

const proxy = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('./proxy', () => ({ proxyAdaptiveRequest: proxy.request }));

import { fetchAdaptiveActivationEvents } from './activation-events';

const FROM = new Date('2026-10-12T00:00:00.000Z');
const TO = new Date('2026-11-23T00:00:00.000Z');
const ACTOR = '000000000000000000000000';
const LEARNER = '64b0000000000000000000a1'; // fake id

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('fetchAdaptiveActivationEvents', () => {
  beforeEach(() => proxy.request.mockReset());

  it('asks the API for the window as admin with a 2 s cap and maps the learners', async () => {
    proxy.request.mockResolvedValue(
      json({
        success: true,
        data: {
          learners: [
            {
              user_id: LEARNER,
              first_completion_at: '2026-10-20T08:00:00+00:00',
              // A naive instant is UTC, as the API means it.
              completions: ['2026-10-20T08:00:00', '2026-10-21T09:30:00.123456Z'],
              succeeded_uploads: [],
            },
            {
              user_id: '64b0000000000000000000a2',
              first_completion_at: null,
              completions: [],
              succeeded_uploads: ['2026-10-22T10:00:00Z'],
            },
          ],
        },
      }),
    );

    const learners = await fetchAdaptiveActivationEvents(FROM, TO, ACTOR);

    const [request, targetPath, auth, options] = proxy.request.mock.calls[0] ?? [];
    expect(targetPath).toBe('/admin/activation/adaptive-events');
    expect(Object.fromEntries(new URL((request as Request).url).searchParams)).toEqual({
      from: '2026-10-12T00:00:00.000Z',
      to: '2026-11-23T00:00:00.000Z',
    });
    expect(auth).toEqual({ userId: ACTOR, userRole: 'admin' });
    expect(options).toEqual({ method: 'GET', timeoutMs: 2_000 });
    expect(learners).toEqual([
      {
        userId: LEARNER,
        firstCompletionAt: new Date('2026-10-20T08:00:00.000Z'),
        completions: [new Date('2026-10-20T08:00:00.000Z'), new Date('2026-10-21T09:30:00.123Z')],
        succeededUploads: [],
      },
      {
        userId: '64b0000000000000000000a2',
        firstCompletionAt: null,
        completions: [],
        succeededUploads: [new Date('2026-10-22T10:00:00.000Z')],
      },
    ]);
  });

  it.each([
    ['an upstream error status', json({ success: false, error: { code: 'x' } }, 504)],
    ['a body that is not JSON', new Response('<html>', { status: 200 })],
    ['a body of the wrong shape', json({ success: true, data: { learners: [{ user_id: 1 }] } })],
    [
      'an invalid instant',
      json({
        success: true,
        data: {
          learners: [
            {
              user_id: LEARNER,
              first_completion_at: 'soon',
              completions: [],
              succeeded_uploads: [],
            },
          ],
        },
      }),
    ],
  ])('throws AdaptiveEventsUnavailableError on %s, naming no response content', async (_, res) => {
    proxy.request.mockResolvedValue(res);
    const error = await fetchAdaptiveActivationEvents(FROM, TO, ACTOR).catch((e: unknown) => e);
    expect(error).toMatchObject({ name: 'AdaptiveEventsUnavailableError' });
    expect(String(error)).not.toContain(LEARNER);
  });
});
