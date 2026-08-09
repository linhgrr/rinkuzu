import { createAiSettingsHandler } from '../../../../proxy';

type Params = { providerId: string; modelId: string };
const path = ({ providerId, modelId }: Params) =>
  `/admin/llm-settings/providers/${encodeURIComponent(providerId)}/models/${encodeURIComponent(modelId)}`;

export const dynamic = 'force-dynamic';
export const PATCH = createAiSettingsHandler<Params>({
  method: 'PATCH',
  path,
  forwardIfMatch: true,
});
export const DELETE = createAiSettingsHandler<Params>({
  method: 'DELETE',
  path,
  forwardIfMatch: true,
});
