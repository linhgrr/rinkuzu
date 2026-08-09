import { fetchApiResponse } from '@/lib/api/client';
import { toAiSettingsViewModel } from '@/features/admin/ai-settings/mappers/ai-settings.mapper';
import type {
  AiSettingsSnapshotDto,
  AiSettingsViewModel,
  CredentialCreateInput,
  CredentialPatchInput,
  ConfigMetaDto,
  KeySelectionInput,
  ModelCreateInput,
  ModelPatchInput,
  ProbeResult,
  ProviderCreateInput,
  ProviderPatchInput,
  RoutingUpdateInput,
} from '@/features/admin/ai-settings/types/ai-settings';

type RevisionMeta = ConfigMetaDto & Record<string, unknown>;
type MutationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type MutationResult<T> = { data: T; revision: number };

function etag(revision: number): string {
  return `"llm-config-${revision}"`;
}

async function mutation<T = unknown>(
  path: string,
  method: MutationMethod,
  revision: number | null,
  body?: unknown,
): Promise<MutationResult<T>> {
  const response = await fetchApiResponse<T, RevisionMeta>(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(revision !== null ? { 'If-Match': etag(revision) } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.meta || typeof response.meta.revision !== 'number') {
    throw new Error('AI settings response is missing revision metadata.');
  }
  return { data: response.data, revision: response.meta.revision };
}

export async function fetchAiSettings(signal?: AbortSignal): Promise<AiSettingsViewModel> {
  const response = await fetchApiResponse<AiSettingsSnapshotDto, RevisionMeta>(
    '/api/admin/ai-settings',
    { cache: 'no-store', ...(signal ? { signal } : {}) },
  );
  return toAiSettingsViewModel(response.data);
}

export const createProvider = (input: ProviderCreateInput, revision: number) =>
  mutation('/api/admin/ai-settings/providers', 'POST', revision, input);

export const patchProvider = (providerId: string, input: ProviderPatchInput, revision: number) =>
  mutation(
    `/api/admin/ai-settings/providers/${encodeURIComponent(providerId)}`,
    'PATCH',
    revision,
    input,
  );

export const deleteProvider = (providerId: string, revision: number) =>
  mutation(
    `/api/admin/ai-settings/providers/${encodeURIComponent(providerId)}`,
    'DELETE',
    revision,
  );

export const testProvider = (providerId: string, input: KeySelectionInput) =>
  mutation<ProbeResult>(
    `/api/admin/ai-settings/providers/${encodeURIComponent(providerId)}/test`,
    'POST',
    null,
    input,
  );

export const createCredential = (
  providerId: string,
  input: CredentialCreateInput,
  revision: number,
) =>
  mutation(
    `/api/admin/ai-settings/providers/${encodeURIComponent(providerId)}/keys`,
    'POST',
    revision,
    input,
  );

export const patchCredential = (
  providerId: string,
  keyId: string,
  input: CredentialPatchInput,
  revision: number,
) =>
  mutation(
    `/api/admin/ai-settings/providers/${encodeURIComponent(providerId)}/keys/${encodeURIComponent(keyId)}`,
    'PATCH',
    revision,
    input,
  );

export const replaceCredentialSecret = (
  providerId: string,
  keyId: string,
  apiKey: string,
  revision: number,
) =>
  mutation(
    `/api/admin/ai-settings/providers/${encodeURIComponent(providerId)}/keys/${encodeURIComponent(keyId)}/secret`,
    'PUT',
    revision,
    { api_key: apiKey },
  );

export const deleteCredential = (providerId: string, keyId: string, revision: number) =>
  mutation(
    `/api/admin/ai-settings/providers/${encodeURIComponent(providerId)}/keys/${encodeURIComponent(keyId)}`,
    'DELETE',
    revision,
  );

export const testCredential = (providerId: string, keyId: string) =>
  mutation<ProbeResult>(
    `/api/admin/ai-settings/providers/${encodeURIComponent(providerId)}/keys/${encodeURIComponent(keyId)}/test`,
    'POST',
    null,
  );

export const createModel = (providerId: string, input: ModelCreateInput, revision: number) =>
  mutation(
    `/api/admin/ai-settings/providers/${encodeURIComponent(providerId)}/models`,
    'POST',
    revision,
    input,
  );

export const patchModel = (
  providerId: string,
  modelId: string,
  input: ModelPatchInput,
  revision: number,
) =>
  mutation(
    `/api/admin/ai-settings/providers/${encodeURIComponent(providerId)}/models/${encodeURIComponent(modelId)}`,
    'PATCH',
    revision,
    input,
  );

export const deleteModel = (providerId: string, modelId: string, revision: number) =>
  mutation(
    `/api/admin/ai-settings/providers/${encodeURIComponent(providerId)}/models/${encodeURIComponent(modelId)}`,
    'DELETE',
    revision,
  );

export const discoverModels = (providerId: string, keyId: string) =>
  mutation<ProbeResult>(
    `/api/admin/ai-settings/providers/${encodeURIComponent(providerId)}/models/discover`,
    'POST',
    null,
    { key_id: keyId },
  );

export const testModel = (providerId: string, modelId: string, keyId: string) =>
  mutation<ProbeResult>(
    `/api/admin/ai-settings/providers/${encodeURIComponent(providerId)}/models/${encodeURIComponent(modelId)}/test`,
    'POST',
    null,
    { key_id: keyId },
  );

export const saveRouting = (input: RoutingUpdateInput, revision: number) =>
  mutation('/api/admin/ai-settings/routing', 'PUT', revision, input);
