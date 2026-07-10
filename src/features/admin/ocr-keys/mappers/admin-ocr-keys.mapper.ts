import type {
  AdminOcrKeyDto,
  AdminOcrKeysListDto,
  AdminOcrKeysViewModel,
  AdminOcrKeyViewModel,
} from '@/features/admin/ocr-keys/types/admin-ocr-keys-view-model';

export function toAdminOcrKeyViewModel(dto: AdminOcrKeyDto): AdminOcrKeyViewModel {
  return {
    id: dto.key_id,
    provider: dto.provider,
    label: dto.label,
    maskedKey: dto.masked_key,
    enabled: dto.enabled,
    status: dto.health_status,
    priority: dto.priority,
    successCount: dto.success_count,
    failureCount: dto.failure_count,
    lastUsedAt: dto.last_used_at ?? null,
    lastSuccessAt: dto.last_success_at ?? null,
    lastErrorAt: dto.last_error_at ?? null,
    lastErrorCode: dto.last_error_code ?? null,
    lastErrorMessage: dto.last_error_message ?? null,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function toAdminOcrKeysViewModel(dto: AdminOcrKeysListDto): AdminOcrKeysViewModel {
  const keys = dto.keys.map(toAdminOcrKeyViewModel);
  return {
    keys,
    fallbackEnvConfigured: dto.fallback_env_configured,
    activeKeyCount: keys.filter((key) => key.enabled).length,
    failedKeyCount: keys.filter((key) => key.status === 'failed').length,
  };
}
