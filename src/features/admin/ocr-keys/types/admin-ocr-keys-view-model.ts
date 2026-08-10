export type AdminOcrKeyHealthStatus = 'untested' | 'healthy' | 'failed' | 'disabled';

export interface AdminOcrKeyDto {
  key_id: string;
  provider: string;
  label: string;
  masked_key: string;
  enabled: boolean;
  health_status: AdminOcrKeyHealthStatus;
  priority: number;
  success_count: number;
  failure_count: number;
  last_used_at?: string | null;
  last_success_at?: string | null;
  last_error_at?: string | null;
  last_error_code?: string | null;
  last_error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminOcrKeysListDto {
  keys: AdminOcrKeyDto[];
  fallback_env_configured: boolean;
}

export interface AdminOcrKeySingleDto {
  key: AdminOcrKeyDto;
}

export interface AdminOcrKeyTestDto {
  key: AdminOcrKeyDto;
  ok: boolean;
  error_code?: string | null;
  error_message?: string | null;
}

export interface AdminOcrKeyDeleteDto {
  deleted: boolean;
  key_id: string;
}

export interface AdminOcrKeyViewModel {
  id: string;
  provider: string;
  label: string;
  maskedKey: string;
  enabled: boolean;
  status: AdminOcrKeyHealthStatus;
  priority: number;
  successCount: number;
  failureCount: number;
  lastUsedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOcrKeysViewModel {
  keys: AdminOcrKeyViewModel[];
  fallbackEnvConfigured: boolean;
  activeKeyCount: number;
  failedKeyCount: number;
}

export interface AdminOcrKeyTestViewModel {
  key: AdminOcrKeyViewModel;
  ok: boolean;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface CreateAdminOcrKeyInput {
  label: string;
  apiKey: string;
  priority: number;
}

export interface UpdateAdminOcrKeyInput {
  label?: string;
  apiKey?: string;
  priority?: number;
  enabled?: boolean;
}

export interface AdminOcrModelSettingsDto {
  provider: string;
  model_name: string;
  source: 'database' | 'environment';
  env_fallback_model: string;
  updated_at?: string | null;
  updated_by?: string | null;
}

export interface AdminOcrModelSettingsViewModel {
  provider: string;
  modelName: string;
  source: 'database' | 'environment';
  envFallbackModel: string;
  updatedAt: string | null;
  updatedBy: string | null;
}
