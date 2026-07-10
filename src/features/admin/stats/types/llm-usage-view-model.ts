export interface LlmUsageBreakdownRow {
  key: string;
  totalTokens: number;
  costUsd: number;
  calls: number;
}

export interface LlmUsageAnalysis {
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
  totalCostUsd: number;
  totalCostVnd: number;
  calls: number;
  byAction: LlmUsageBreakdownRow[];
  byModel: LlmUsageBreakdownRow[];
  byUser: LlmUsageBreakdownRow[];
  analysis: LlmUsageAnalysis;
}
