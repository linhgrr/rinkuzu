import { describe, expect, it, vi } from 'vitest';
import {
  createPostizConnector,
  mapPostizPost,
  POSTIZ_CAPABILITIES,
  PostizConnectorError,
} from './connector';

const threadsId = 'cmrxbd9bg0004li8fyg626pi7';
const telegramId = 'cmrx2wuru0001ne81kz37lcys';

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function connector(fetchImpl: typeof fetch) {
  return createPostizConnector({
    baseUrl: 'https://social.example.test/public/v1/',
    apiKey: 'test-secret',
    ownedIntegrationIds: new Set([threadsId, telegramId]),
    fetchImpl,
  });
}

describe('Postiz privacy-safe connector', () => {
  it('declares unsupported reply/comment capabilities with reasons for both providers', () => {
    for (const platform of ['threads', 'telegram'] as const) {
      expect(POSTIZ_CAPABILITIES[platform].postHistory.supported).toBe(true);
      expect(POSTIZ_CAPABILITIES[platform].comments).toEqual({
        supported: false,
        reason: expect.any(String),
      });
      expect(POSTIZ_CAPABILITIES[platform].singleReply.supported).toBe(false);
    }
  });

  it('maps explicit nulls and omits audience and content PII', () => {
    const upstreamPost = {
      id: 'post-1',
      publishDate: '2026-08-12T00:00:00Z',
      releaseURL: null,
      integration: { id: threadsId, providerIdentifier: 'threads' },
      author: { email: 'audience@example.test' },
      content: 'private audience text',
    };
    const mapped = mapPostizPost(upstreamPost);
    expect(mapped.providerState).toBeNull();
    expect(mapped.providerStateUnavailableReason).toMatch(/did not return/);
    expect(JSON.stringify(mapped)).not.toContain('audience@example.test');
    expect(JSON.stringify(mapped)).not.toContain('private audience text');
  });

  it.each([
    ['threads', threadsId],
    ['telegram', telegramId],
  ])('scopes and maps %s post history independently', async (platform, integrationId) => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response([
          { id: threadsId, identifier: 'threads' },
          { id: telegramId, identifier: 'telegram' },
        ]),
      )
      .mockResolvedValueOnce(
        response({
          posts: [
            {
              id: `${platform}-post`,
              status: 'DRAFT',
              integration: { id: integrationId, providerIdentifier: platform },
            },
            {
              id: 'other-post',
              integration: { id: platform === 'threads' ? telegramId : threadsId },
            },
          ],
        }),
      );
    const result = await connector(fetchImpl).listPosts({
      integrationId,
      startDate: '2026-08-01T00:00:00Z',
      endDate: '2026-08-13T00:00:00Z',
    });
    expect(result).toMatchObject({ platform, posts: [{ postId: `${platform}-post` }] });
    expect(result.posts).toHaveLength(1);
    expect(fetchImpl).toHaveBeenLastCalledWith(
      expect.stringContaining('startDate=2026-08-01T00%3A00%3A00Z'),
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('fails before upstream access for a non-owned integration', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      connector(fetchImpl).listPosts({
        integrationId: 'third-party',
        startDate: '2026-08-01T00:00:00Z',
        endDate: '2026-08-13T00:00:00Z',
      }),
    ).rejects.toMatchObject({ code: 'POSTIZ_INTEGRATION_NOT_OWNED', status: 403 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('checks post ownership before returning aggregate analytics', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response([{ id: threadsId, providerIdentifier: 'threads' }]))
      .mockResolvedValueOnce(
        response({ posts: [{ id: 'owned-post', integration: { id: threadsId } }] }),
      )
      .mockResolvedValueOnce(
        response([{ label: 'Likes', data: [{ total: '4', date: '2026-08-12' }] }]),
      );
    const result = await connector(fetchImpl).getAnalytics({
      integrationId: threadsId,
      postId: 'owned-post',
      date: 30,
      startDate: '2026-08-01T00:00:00Z',
      endDate: '2026-08-13T00:00:00Z',
    });
    expect(result.metrics).toEqual([
      {
        label: 'Likes',
        points: [{ timestamp: '2026-08-12', total: 4 }],
        percentageChange: null,
      },
    ]);
  });

  it('reports empty upstream analytics as unavailable rather than zero', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response([{ id: telegramId, identifier: 'telegram' }]))
      .mockResolvedValueOnce(
        response({ posts: [{ id: 'draft-post', integration: { id: telegramId } }] }),
      )
      .mockResolvedValueOnce(response([]));
    await expect(
      connector(fetchImpl).getAnalytics({
        integrationId: telegramId,
        postId: 'draft-post',
        date: 30,
        startDate: '2026-08-01T00:00:00Z',
        endDate: '2026-08-13T00:00:00Z',
      }),
    ).rejects.toMatchObject({ code: 'POSTIZ_ANALYTICS_UNAVAILABLE', status: 409 });
  });

  it('fails closed for replies and upstream authorization errors', async () => {
    expect(() => connector(vi.fn<typeof fetch>()).reply()).toThrowError(PostizConnectorError);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({}, 401));
    await expect(
      connector(fetchImpl).listPosts({
        integrationId: threadsId,
        startDate: '2026-08-01T00:00:00Z',
        endDate: '2026-08-13T00:00:00Z',
      }),
    ).rejects.toMatchObject({ code: 'POSTIZ_AUTHORIZATION_FAILED' });
  });
});
