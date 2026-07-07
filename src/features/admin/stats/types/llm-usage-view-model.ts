export interface LlmUsageBreakdownRow {
  key: string;
  totalTokens: number;
  costUsd: number;
  calls: number;
}

export interface LlmUsageViewModel {
  windowDays: number;
  totalTokens: number;
  totalCostUsd: number;
  totalCostVnd: number;
  calls: number;
  byAction: LlmUsageBreakdownRow[];
  byModel: LlmUsageBreakdownRow[];
}
