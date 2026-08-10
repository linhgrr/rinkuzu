interface LlmUsageMetrics {
  logicalOperations: number;
  physicalAttempts: number;
  successfulOperations: number;
  failedOperations: number;
  fallbackOperations: number;
  recoverableFailures: number;
  totalLatencyMs: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  cacheObservedAttempts: number;
  inputCacheHitTokens: number;
  inputCacheMissTokens: number;
  cacheSavingsUsd: number;
}

export interface LlmUsageBreakdownRow extends LlmUsageMetrics {
  key: string;
}

export interface LlmUsageBreakdown {
  rows: LlmUsageBreakdownRow[];
  truncated: boolean;
}

export type LlmUsageWindow = '1d' | '7d' | '30d' | '90d' | '180d';

export interface LlmUsageFilters {
  action?: string;
  userId?: string;
  providerId?: string;
  modelId?: string;
  includeNonProduct?: boolean;
}

interface LlmUsageUserActionRow extends LlmUsageMetrics {
  userId: string;
  action: string;
}

interface LlmUsageUserActionBreakdown {
  rows: LlmUsageUserActionRow[];
  truncated: boolean;
}

export interface LlmUsageDailyPoint {
  date: string;
  logicalOperations: number;
  physicalAttempts: number;
  successfulOperations: number;
  failedOperations: number;
  fallbackOperations: number;
  recoverableFailures: number;
  totalLatencyMs: number;
  totalTokens: number;
  costUsd: number;
  cacheObservedAttempts: number;
  inputCacheHitTokens: number;
  inputCacheMissTokens: number;
  cacheSavingsUsd: number;
}

interface LlmUsageAnalysis {
  averageTokensPerOperation: number;
  averageCostUsdPerOperation: number;
  averageCostUsdPerSuccessfulOperation: number;
  averageLatencyMsPerOperation: number;
  attemptsPerOperation: number;
  successRate: number;
  fallbackRate: number;
  cacheHitRate: number;
  cacheCoverage: number;
  topUserId: string;
  topUserCostUsd: number;
  topAction: string;
  topActionCostShare: number;
  topModel: string;
  topModelCostShare: number;
}

interface LlmUsagePeriodTotals {
  totalTokens: number;
  totalCostUsd: number;
  logicalOperations: number;
  physicalAttempts: number;
  successfulOperations: number;
  failedOperations: number;
  fallbackOperations: number;
  totalLatencyMs: number;
  cacheObservedAttempts: number;
  inputCacheHitTokens: number;
  inputCacheMissTokens: number;
  cacheSavingsUsd: number;
}

interface LlmUsageObservability {
  tokenAnomalies: number;
  unknownPricing: number;
  usageUnavailable: number;
  persistenceFailures: number;
  missingAttribution: number;
}

export interface LlmUsageViewModel {
  windowDays: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  totalCostVnd: number;
  logicalOperations: number;
  physicalAttempts: number;
  successfulOperations: number;
  failedOperations: number;
  fallbackOperations: number;
  recoverableFailures: number;
  totalLatencyMs: number;
  cacheObservedAttempts: number;
  inputCacheHitTokens: number;
  inputCacheMissTokens: number;
  cacheSavingsUsd: number;
  previousPeriod: LlmUsagePeriodTotals;
  byAction: LlmUsageBreakdown;
  byModel: LlmUsageBreakdown;
  byUser: LlmUsageBreakdown;
  byProvider: LlmUsageBreakdown;
  byOutcome: LlmUsageBreakdown;
  byErrorCode: LlmUsageBreakdown;
  byUserAction: LlmUsageUserActionBreakdown;
  daily: LlmUsageDailyPoint[];
  observability: LlmUsageObservability;
  analysis: LlmUsageAnalysis;
}
