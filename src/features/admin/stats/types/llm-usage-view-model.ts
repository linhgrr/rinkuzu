export interface LlmUsageBreakdownRow {
  key: string;
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

export interface LlmUsageUserActionRow {
  userId: string;
  action: string;
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
}

export interface LlmUsageUserActionBreakdown {
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
}

export interface LlmUsageAnalysis {
  averageTokensPerOperation: number;
  averageCostUsdPerOperation: number;
  averageCostUsdPerSuccessfulOperation: number;
  averageLatencyMsPerOperation: number;
  attemptsPerOperation: number;
  successRate: number;
  fallbackRate: number;
  topUserId: string;
  topUserCostUsd: number;
  topAction: string;
  topActionCostShare: number;
  topModel: string;
  topModelCostShare: number;
}

export interface LlmUsagePeriodTotals {
  totalTokens: number;
  totalCostUsd: number;
  logicalOperations: number;
  physicalAttempts: number;
  successfulOperations: number;
  failedOperations: number;
  fallbackOperations: number;
  totalLatencyMs: number;
}

export interface LlmUsageObservability {
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
