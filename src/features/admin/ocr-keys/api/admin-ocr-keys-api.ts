import { fetchApiData } from '@/lib/api/client';
import {
  toAdminOcrKeysViewModel,
  toAdminOcrKeyViewModel,
} from '@/features/admin/ocr-keys/mappers/admin-ocr-keys.mapper';
import type {
  AdminOcrKeyDeleteDto,
  AdminOcrKeysListDto,
  AdminOcrKeysViewModel,
  AdminOcrKeySingleDto,
  AdminOcrKeyTestDto,
  AdminOcrKeyTestViewModel,
  AdminOcrKeyViewModel,
  CreateAdminOcrKeyInput,
  UpdateAdminOcrKeyInput,
} from '@/features/admin/ocr-keys/types/admin-ocr-keys-view-model';

interface AdminOcrKeyCreatePayload {
  label: string;
  api_key: string;
  priority: number;
}

interface AdminOcrKeyPatchPayload {
  label?: string;
  api_key?: string;
  priority?: number;
  enabled?: boolean;
}

function toCreatePayload(input: CreateAdminOcrKeyInput): AdminOcrKeyCreatePayload {
  return {
    label: input.label,
    api_key: input.apiKey,
    priority: input.priority,
  };
}

function toPatchPayload(input: UpdateAdminOcrKeyInput): AdminOcrKeyPatchPayload {
  return {
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.apiKey !== undefined ? { api_key: input.apiKey } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
  };
}

export async function fetchAdminOcrKeysViewModel(
  signal?: AbortSignal,
): Promise<AdminOcrKeysViewModel> {
  const data = await fetchApiData<AdminOcrKeysListDto>('/api/admin/ocr-keys', { signal });
  return toAdminOcrKeysViewModel(data);
}

export async function createAdminOcrKey(
  input: CreateAdminOcrKeyInput,
): Promise<AdminOcrKeyViewModel> {
  const data = await fetchApiData<AdminOcrKeySingleDto>('/api/admin/ocr-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toCreatePayload(input)),
  });
  return toAdminOcrKeyViewModel(data.key);
}

export async function updateAdminOcrKey(
  keyId: string,
  input: UpdateAdminOcrKeyInput,
): Promise<AdminOcrKeyViewModel> {
  const data = await fetchApiData<AdminOcrKeySingleDto>(
    `/api/admin/ocr-keys/${encodeURIComponent(keyId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toPatchPayload(input)),
    },
  );
  return toAdminOcrKeyViewModel(data.key);
}

export async function testAdminOcrKey(keyId: string): Promise<AdminOcrKeyTestViewModel> {
  const data = await fetchApiData<AdminOcrKeyTestDto>(
    `/api/admin/ocr-keys/${encodeURIComponent(keyId)}/test`,
    { method: 'POST' },
  );
  return {
    key: toAdminOcrKeyViewModel(data.key),
    ok: data.ok,
    errorCode: data.error_code ?? null,
    errorMessage: data.error_message ?? null,
  };
}

export async function deleteAdminOcrKey(keyId: string): Promise<AdminOcrKeyDeleteDto> {
  return fetchApiData<AdminOcrKeyDeleteDto>(`/api/admin/ocr-keys/${encodeURIComponent(keyId)}`, {
    method: 'DELETE',
  });
}
