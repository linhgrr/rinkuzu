type AdaptiveCacheTags = {
  readonly health: 'adaptive:health';
  readonly pipelineStatus: 'adaptive:pipeline-status';
};

type AdaptiveCacheTtlSeconds = {
  readonly health: 10;
  readonly pipelineStatus: 5;
};

export const ADAPTIVE_CACHE_TAGS: AdaptiveCacheTags = {
  health: 'adaptive:health',
  pipelineStatus: 'adaptive:pipeline-status',
};

export const ADAPTIVE_CACHE_TTL_SECONDS: AdaptiveCacheTtlSeconds = {
  health: 10,
  pipelineStatus: 5,
};
