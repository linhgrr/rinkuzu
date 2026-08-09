import { createAiSettingsHandler } from '../../../../../proxy';

type Params = { providerId: string; modelId: string };
export const dynamic = 'force-dynamic';
export const POST = createAiSettingsHandler<Params>({
  method: 'POST',
  path: ({ providerId, modelId }) =>
    `/admin/llm-settings/providers/${encodeURIComponent(providerId)}/models/${encodeURIComponent(modelId)}/test`,
});
