export interface LlmUsageBreakdownRow {
  key: string;
  logicalOperations: number;
  physicalAttempts: number;
  recoverableFailures: number;
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
  recoverableFailures: number;
  totalTokens: number;
  costUsd: number;
}

export interface LlmUsageAnalysis {
  averageTokensPerOperation: number;
  averageCostUsdPerOperation: number;
  successRate: number;
  fallbackRate: number;
  topUserId: string;
  topUserCostUsd: number;
  topAction: string;
  topActionCostShare: number;
  topModel: string;
  topModelCostShare: number;
}

export interface LlmUsageObservability {
  tokenAnomalies: number;
  unknownPricing: number;
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
  byAction: LlmUsageBreakdown;
  byModel: LlmUsageBreakdown;
  byUser: LlmUsageBreakdown;
  byProvider: LlmUsageBreakdown;
  byUserAction: LlmUsageUserActionBreakdown;
  daily: LlmUsageDailyPoint[];
  observability: LlmUsageObservability;
  analysis: LlmUsageAnalysis;
}
