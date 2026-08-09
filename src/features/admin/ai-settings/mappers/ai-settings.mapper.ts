import type {
  AiSettingsSnapshotDto,
  AiSettingsViewModel,
} from '@/features/admin/ai-settings/types/ai-settings';

/** Whitelist-map the public DTO so secret-like provider fields cannot enter UI state. */
export function toAiSettingsViewModel(dto: AiSettingsSnapshotDto): AiSettingsViewModel {
  return {
    revision: dto.revision,
    actions: dto.actions.map((action) => ({
      action: action.action,
      group: action.group,
      label: action.label,
      description: action.description,
      required_capabilities: [...action.required_capabilities],
    })),
    pipelineSteps: dto.pipeline_steps.map((step) => ({ ...step })),
    providers: dto.providers.map((provider) => ({
      id: provider.provider_id,
      name: provider.name,
      origin: provider.normalized_origin,
      baseUrl: provider.base_url,
      enabled: provider.enabled,
      timeoutSec: provider.timeout_sec,
    })),
    credentials: dto.credentials
      .map((credential) => ({
        id: credential.key_id,
        providerId: credential.provider_id,
        label: credential.label,
        maskedKey: credential.masked_key,
        priority: credential.priority,
        enabled: credential.enabled,
        secretVersion: credential.secret_version,
        healthStatus: credential.health?.status ?? 'untested',
        successCount: credential.health?.success_count ?? 0,
        failureCount: credential.health?.failure_count ?? 0,
        lastUsedAt: credential.health?.last_used_at ?? null,
        lastErrorCode: credential.health?.last_error_code ?? null,
      }))
      .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id)),
    models: dto.models.map((model) => ({
      id: model.model_id,
      providerId: model.provider_id,
      displayName: model.display_name,
      upstreamName: model.upstream_model_name,
      enabled: model.enabled,
      capabilities: [...model.capabilities],
      timeoutSec: model.timeout_sec_override ?? null,
      inputPrice: model.input_price_usd_per_m_tokens ?? null,
      cacheHitPrice: model.input_cache_hit_price_usd_per_m_tokens ?? null,
      outputPrice: model.output_price_usd_per_m_tokens ?? null,
    })),
    routes: dto.routes.map((route) => ({ action: route.action, model_ids: [...route.model_ids] })),
    stepPolicies: dto.step_policies.map((policy) => ({ ...policy })),
  };
}
