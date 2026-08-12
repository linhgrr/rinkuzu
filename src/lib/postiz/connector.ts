import 'server-only';

export type PostizPlatform = 'threads' | 'telegram';

export type CapabilityState = {
  supported: boolean;
  reason: string | null;
};

export type PostizCapabilityMatrix = Record<
  PostizPlatform,
  {
    postHistory: CapabilityState;
    aggregateAnalytics: CapabilityState;
    comments: CapabilityState;
    singleReply: CapabilityState;
  }
>;

export const POSTIZ_CAPABILITIES: PostizCapabilityMatrix = {
  threads: {
    postHistory: { supported: true, reason: null },
    aggregateAnalytics: { supported: true, reason: null },
    comments: {
      supported: false,
      reason: 'Postiz Public API exposes no authenticated comment-history endpoint.',
    },
    singleReply: {
      supported: false,
      reason: 'Postiz Public API exposes no explicit owned-Threads reply endpoint.',
    },
  },
  telegram: {
    postHistory: { supported: true, reason: null },
    aggregateAnalytics: { supported: true, reason: null },
    comments: {
      supported: false,
      reason: 'Postiz Public API exposes no authenticated Telegram reply-history endpoint.',
    },
    singleReply: {
      supported: false,
      reason: 'Postiz Public API exposes no explicit owned-Telegram single-reply endpoint.',
    },
  },
};

type UpstreamIntegration = {
  id?: unknown;
  identifier?: unknown;
  providerIdentifier?: unknown;
};

type UpstreamPost = {
  id?: unknown;
  contentId?: unknown;
  publishDate?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  releaseURL?: unknown;
  state?: unknown;
  status?: unknown;
  integration?: UpstreamIntegration | null;
};

type UpstreamMetric = {
  label?: unknown;
  data?: unknown;
  percentageChange?: unknown;
};

export class PostizConnectorError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PostizConnectorError';
  }
}

export type PostizConnectorOptions = {
  baseUrl: string;
  apiKey: string;
  ownedIntegrationIds: ReadonlySet<string>;
  fetchImpl?: typeof fetch;
};

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function platformOf(value: unknown): PostizPlatform | null {
  const normalized = stringOrNull(value)?.toLowerCase();
  return normalized === 'threads' || normalized === 'telegram' ? normalized : null;
}

function finiteNumberOrNull(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapMetric(metric: UpstreamMetric) {
  const points = Array.isArray(metric.data)
    ? metric.data.map((point) => {
        const record = point && typeof point === 'object' ? (point as Record<string, unknown>) : {};
        return {
          timestamp: stringOrNull(record['date']),
          total: finiteNumberOrNull(record['total']),
        };
      })
    : [];

  return {
    label: stringOrNull(metric.label),
    points,
    percentageChange: finiteNumberOrNull(metric.percentageChange),
  };
}

export function mapPostizPost(post: UpstreamPost) {
  const integrationId = stringOrNull(post.integration?.id);
  const platform = platformOf(post.integration?.providerIdentifier);
  const providerState = stringOrNull(post.state) ?? stringOrNull(post.status);

  return {
    postId: stringOrNull(post.id),
    contentId: stringOrNull(post.contentId),
    integrationId,
    platform,
    publicUrl: stringOrNull(post.releaseURL),
    publishedAt: stringOrNull(post.publishDate),
    createdAt: stringOrNull(post.createdAt),
    updatedAt: stringOrNull(post.updatedAt),
    providerState,
    providerStateUnavailableReason:
      providerState === null ? 'Postiz did not return provider state for this item.' : null,
  };
}

export function createPostizConnector(options: PostizConnectorOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, '');

  async function request(path: string): Promise<unknown> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      headers: { Authorization: options.apiKey, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new PostizConnectorError(
        response.status === 401 || response.status === 403
          ? 'POSTIZ_AUTHORIZATION_FAILED'
          : 'POSTIZ_UPSTREAM_UNAVAILABLE',
        `Postiz request failed with HTTP ${response.status}.`,
        response.status === 401 || response.status === 403 ? response.status : 502,
        { upstreamStatus: response.status },
      );
    }
    return response.json();
  }

  async function requireOwnedIntegration(integrationId: string) {
    if (!options.ownedIntegrationIds.has(integrationId)) {
      throw new PostizConnectorError(
        'POSTIZ_INTEGRATION_NOT_OWNED',
        'The requested integration is outside the configured owned-channel scope.',
        403,
      );
    }
    const payload = await request('/integrations');
    const integrations = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { integrations?: unknown })?.integrations)
        ? (payload as { integrations: unknown[] }).integrations
        : [];
    const integration = integrations.find(
      (item) => stringOrNull((item as UpstreamIntegration)?.id) === integrationId,
    ) as UpstreamIntegration | undefined;
    const platform = platformOf(integration?.providerIdentifier ?? integration?.identifier);
    if (!integration || !platform) {
      throw new PostizConnectorError(
        'POSTIZ_INTEGRATION_UNAVAILABLE',
        'The owned integration was not returned by Postiz or its provider is unsupported.',
        409,
      );
    }
    return platform;
  }

  return {
    capabilities: POSTIZ_CAPABILITIES,

    async listPosts(input: { integrationId: string; startDate: string; endDate: string }) {
      const platform = await requireOwnedIntegration(input.integrationId);
      const query = new URLSearchParams({ startDate: input.startDate, endDate: input.endDate });
      const payload = await request(`/posts?${query.toString()}`);
      const rawPosts = Array.isArray((payload as { posts?: unknown })?.posts)
        ? (payload as { posts: UpstreamPost[] }).posts
        : [];
      const posts = rawPosts
        .filter((post) => stringOrNull(post.integration?.id) === input.integrationId)
        .map(mapPostizPost);
      return { integrationId: input.integrationId, platform, posts };
    },

    async getAnalytics(input: {
      integrationId: string;
      postId: string;
      date: number;
      startDate: string;
      endDate: string;
    }) {
      const history = await this.listPosts(input);
      if (!history.posts.some((post) => post.postId === input.postId)) {
        throw new PostizConnectorError(
          'POSTIZ_POST_NOT_OWNED',
          'The requested post was not found in the owned integration history.',
          403,
        );
      }
      const payload = await request(
        `/analytics/post/${encodeURIComponent(input.postId)}?date=${input.date}`,
      );
      if (!Array.isArray(payload)) {
        throw new PostizConnectorError(
          'POSTIZ_CAPABILITY_UNAVAILABLE',
          'Postiz did not return an aggregate analytics array.',
          502,
        );
      }
      if (payload.length === 0) {
        throw new PostizConnectorError(
          'POSTIZ_ANALYTICS_UNAVAILABLE',
          'Postiz returned no aggregate analytics for this item; metrics are unavailable, not zero.',
          409,
          { reason: 'The post may be a draft, unpublished, or unsupported by its provider.' },
        );
      }
      return {
        integrationId: input.integrationId,
        postId: input.postId,
        platform: history.platform,
        metrics: (payload as UpstreamMetric[]).map(mapMetric),
      };
    },

    reply(): never {
      throw new PostizConnectorError(
        'POSTIZ_CAPABILITY_UNSUPPORTED',
        'Single-item replies are disabled because Postiz provider support and authorization are not proven.',
        409,
      );
    },
  };
}
