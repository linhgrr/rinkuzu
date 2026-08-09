import { createAiSettingsHandler } from '../../../../../proxy';

type Params = { providerId: string; keyId: string };
export const dynamic = 'force-dynamic';
export const POST = createAiSettingsHandler<Params>({
  method: 'POST',
  path: ({ providerId, keyId }) =>
    `/admin/llm-settings/providers/${encodeURIComponent(providerId)}/keys/${encodeURIComponent(keyId)}/test`,
});
