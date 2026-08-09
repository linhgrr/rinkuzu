import { createAiSettingsHandler } from '../../../../../proxy';

type Params = { providerId: string; keyId: string };
export const dynamic = 'force-dynamic';
export const PUT = createAiSettingsHandler<Params>({
  method: 'PUT',
  path: ({ providerId, keyId }) =>
    `/admin/llm-settings/providers/${encodeURIComponent(providerId)}/keys/${encodeURIComponent(keyId)}/secret`,
  forwardIfMatch: true,
});
