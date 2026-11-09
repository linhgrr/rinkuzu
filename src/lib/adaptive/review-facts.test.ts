import { beforeEach, describe, expect, it, vi } from 'vitest';

const proxy = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('./proxy', () => ({ proxyAdaptiveRequest: proxy.request }));

import { AdaptiveReviewFactsUnavailableError, fetchAdaptiveReviewFacts } from './review-facts';

const LEARNER = '64b0000000000000000000a1'; // fake id
const AFTER = new Date('2026-11-01T08:00:00.000Z');

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('fetchAdaptiveReviewFacts', () => {
  beforeEach(() => proxy.request.mockReset());

  it('asks for one learner as the service admin with a 2 s cap and maps the facts', async () => {
    proxy.request.mockResolvedValue(
      json({
        success: true,
        data: {
          latest_completion: {
            completed_at: '2026-11-01T08:00:00',
            document_id: 'session-1',
            job_id: 'job-1',
            document_title: 'Biology notes.pdf',
            due_count: 3,
          },
          completions_after: ['2026-11-02T09:30:00.123456Z'],
        },
      }),
    );

    const facts = await fetchAdaptiveReviewFacts(LEARNER, AFTER);

    const [request, targetPath, auth, options] = proxy.request.mock.calls[0] ?? [];
    expect(targetPath).toBe(`/admin/review-reminder/adaptive/${LEARNER}`);
    expect(Object.fromEntries(new URL((request as Request).url).searchParams)).toEqual({
      after: '2026-11-01T08:00:00.000Z',
    });
    expect(auth).toEqual({ userId: '000000000000000000000000', userRole: 'admin' });
    expect(options).toEqual({ method: 'GET', timeoutMs: 2_000 });
    expect(facts).toEqual({
      latestCompletion: {
        // A naive instant is UTC, as the API means it.
        completedAt: new Date('2026-11-01T08:00:00.000Z'),
        documentId: 'session-1',
        documentTitle: 'Biology notes.pdf',
        dueCount: 3,
      },
      completionsAfter: [new Date('2026-11-02T09:30:00.123Z')],
    });
  });

  it('sends no after when none is given and maps a learner without completions', async () => {
    proxy.request.mockResolvedValue(
      json({ success: true, data: { latest_completion: null, completions_after: [] } }),
    );

    await expect(fetchAdaptiveReviewFacts(LEARNER)).resolves.toEqual({
      latestCompletion: null,
      completionsAfter: [],
    });
    const [request] = proxy.request.mock.calls[0] ?? [];
    expect(new URL((request as Request).url).search).toBe('');
  });

  it.each([
    ['an upstream error status', () => json({ success: false }, 504)],
    ['a body that is not JSON', () => new Response('<html>', { status: 200 })],
    [
      'a body of the wrong shape',
      () => json({ success: true, data: { latest_completion: { due_count: -1 } } }),
    ],
    ['a proxy timeout', () => json({ success: false, error: { code: 'upstream_timeout' } }, 504)],
  ])('throws a content-free error on %s', async (_label, respond) => {
    proxy.request.mockImplementation(async () => respond());

    const error = await fetchAdaptiveReviewFacts(LEARNER).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AdaptiveReviewFactsUnavailableError);
    expect(String(error)).not.toContain(LEARNER);
  });
});
