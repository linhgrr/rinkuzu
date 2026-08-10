import type { components } from '@/generated/adaptive-api';

export type LlmAction = components['schemas']['LlmAction'];
export type LlmCapability = components['schemas']['LlmCapability'];
export type ProviderCreateInput = components['schemas']['ProviderCreateRequest'];
export type ProviderPatchInput = components['schemas']['ProviderPatchRequest'];
export type CredentialCreateInput = components['schemas']['CredentialCreateRequest'];
export type CredentialPatchInput = components['schemas']['CredentialPatchRequest'];
export type ModelCreateInput = components['schemas']['ModelCreateRequest'];
export type ModelPatchInput = components['schemas']['ModelPatchRequest'];
export type RoutingUpdateInput = components['schemas']['RoutingUpdateRequest'];
export type KeySelectionInput = components['schemas']['KeySelectionRequest'];
export type ConfigMetaDto = components['schemas']['ConfigMeta'];

type ActionDefinitionDto = components['schemas']['LlmActionDefinitionResponse'];
type PipelineStepDto = components['schemas']['PipelineStepDefinitionResponse'];
type RouteDto = components['schemas']['RouteResponse'];
type StepPolicyDto = components['schemas']['StepPolicyResponse'];
export type AiSettingsSnapshotDto = components['schemas']['LlmSettingsSnapshotResponse'];

export type ProviderViewModel = {
  id: string;
  name: string;
  origin: string;
  baseUrl: string;
  enabled: boolean;
  timeoutSec: number;
};

export type CredentialViewModel = {
  id: string;
  providerId: string;
  label: string;
  maskedKey: string;
  priority: number;
  enabled: boolean;
  secretVersion: number;
  healthStatus: string;
  successCount: number;
  failureCount: number;
  lastUsedAt: string | null;
  lastErrorCode: string | null;
};

export type ModelViewModel = {
  id: string;
  providerId: string;
  displayName: string;
  upstreamName: string;
  enabled: boolean;
  capabilities: LlmCapability[];
  timeoutSec: number | null;
  inputPrice: string | null;
  cacheHitPrice: string | null;
  outputPrice: string | null;
};

export type AiSettingsViewModel = {
  revision: number;
  actions: ActionDefinitionDto[];
  pipelineSteps: PipelineStepDto[];
  providers: ProviderViewModel[];
  credentials: CredentialViewModel[];
  models: ModelViewModel[];
  routes: RouteDto[];
  stepPolicies: StepPolicyDto[];
};

export type RoutingMutationPolicy = 'discard' | 'preserve' | 'commit';

export type AiSettingsMutate = (
  task: () => Promise<unknown>,
  success: string,
  routingPolicy?: RoutingMutationPolicy,
) => Promise<boolean>;

export type ProbeResult = {
  ok?: boolean;
  latency_ms?: number;
  model_count?: number;
  model_ids?: string[];
};
