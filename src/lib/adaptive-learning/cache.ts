export const ADAPTIVE_CACHE_TAGS = {
  health: 'adaptive:health',
  pipelineStatus: 'adaptive:pipeline-status',
} as const;

export const ADAPTIVE_CACHE_TTL_SECONDS = {
  health: 10,
  pipelineStatus: 5,
} as const;
