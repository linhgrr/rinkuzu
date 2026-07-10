import { fetchApiData } from '@/lib/api/client';
import type { components } from '@/generated/adaptive-api';
import type {
  LlmUsageBreakdownRow,
  LlmUsageViewModel,
} from '@/features/admin/stats/types/llm-usage-view-model';

type ApiSchemas = components['schemas'];

// USD→VND display rate. Kept here (not in the pricing config) because it only
// affects how admin cost is shown, not billing. Override via env if needed.
const USD_TO_VND = Number(process.env['NEXT_PUBLIC_USD_TO_VND']) || 25_000;

type LlmUsageSummaryDto = ApiSchemas['LlmUsageSummaryResponse'];
type UsageBreakdownDto = ApiSchemas['LlmUsageBreakdownRow'];

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
    byUser: dto.by_user.map(toRow),
    analysis: {
      activeUsers: dto.analysis.active_users,
      averageTokensPerCall: dto.analysis.average_tokens_per_call,
      averageCostUsdPerCall: dto.analysis.average_cost_usd_per_call,
      topUserId: dto.analysis.top_user_id ?? '(unknown)',
      topUserCostUsd: dto.analysis.top_user_cost_usd,
      topAction: dto.analysis.top_action ?? '(unknown)',
      topActionCostShare: dto.analysis.top_action_cost_share,
      topModel: dto.analysis.top_model ?? '(unknown)',
      topModelCostShare: dto.analysis.top_model_cost_share,
    },
  };
}
