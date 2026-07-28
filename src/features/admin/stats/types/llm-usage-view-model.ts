export interface LlmUsageBreakdownRow {
  key: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  calls: number;
}

export type LlmUsageWindow = '7d' | '30d' | '90d' | '180d';

export interface LlmUsageDailyPoint {
  date: string;
  totalTokens: number;
  costUsd: number;
  calls: number;
}

interface LlmUsageAnalysis {
  activeUsers: number;
  averageTokensPerCall: number;
  averageCostUsdPerCall: number;
  topUserId: string;
  topUserCostUsd: number;
  topAction: string;
  topActionCostShare: number;
  topModel: string;
  topModelCostShare: number;
}

export interface LlmUsageViewModel {
  windowDays: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  totalCostVnd: number;
  calls: number;
  byAction: LlmUsageBreakdownRow[];
  byModel: LlmUsageBreakdownRow[];
  byUser: LlmUsageBreakdownRow[];
  daily: LlmUsageDailyPoint[];
  analysis: LlmUsageAnalysis;
}
