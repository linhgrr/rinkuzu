import { fetchApiData } from '@/lib/api/client';
import type {
  LlmUsageBreakdownRow,
  LlmUsageViewModel,
} from '@/features/admin/stats/types/llm-usage-view-model';

// USD→VND display rate. Kept here (not in the pricing config) because it only
// affects how admin cost is shown, not billing. Override via env if needed.
const USD_TO_VND = Number(process.env['NEXT_PUBLIC_USD_TO_VND']) || 25_000;

interface UsageBreakdownDto {
  key: string | null;
  total_tokens?: number;
  cost_usd?: number;
  calls?: number;
}

interface UsageTotalsDto {
  total_tokens: number;
  cost_usd: number;
  calls: number;
}

interface LlmUsageSummaryDto {
  window_days: number;
  totals: UsageTotalsDto;
  by_action: UsageBreakdownDto[];
  by_model: UsageBreakdownDto[];
}

function toRow(dto: UsageBreakdownDto): LlmUsageBreakdownRow {
  return {
    key: dto.key ?? '(unknown)',
    totalTokens: dto.total_tokens ?? 0,
    costUsd: dto.cost_usd ?? 0,
    calls: dto.calls ?? 0,
  };
}

export async function fetchLlmUsageViewModel(window = '30d'): Promise<LlmUsageViewModel> {
  const dto = await fetchApiData<LlmUsageSummaryDto>(`/api/admin/llm-usage?window=${window}`);
  return {
    windowDays: dto.window_days,
    totalTokens: dto.totals.total_tokens,
    totalCostUsd: dto.totals.cost_usd,
    totalCostVnd: Math.round(dto.totals.cost_usd * USD_TO_VND),
    calls: dto.totals.calls,
    byAction: dto.by_action.map(toRow),
    byModel: dto.by_model.map(toRow),
  };
}
