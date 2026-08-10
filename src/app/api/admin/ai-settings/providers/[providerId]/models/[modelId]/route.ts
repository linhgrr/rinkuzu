import { createMutableAiSettingsResourceHandlers } from '../../../../proxy';

type Params = { providerId: string; modelId: string };
const path = ({ providerId, modelId }: Params) =>
  `/admin/llm-settings/providers/${encodeURIComponent(providerId)}/models/${encodeURIComponent(modelId)}`;

export const dynamic = 'force-dynamic';
const handlers = createMutableAiSettingsResourceHandlers<Params>(path);
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
