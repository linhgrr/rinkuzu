import { createAiSettingsHandler } from '../../../../proxy';

type Params = { providerId: string; keyId: string };
const path = ({ providerId, keyId }: Params) =>
  `/admin/llm-settings/providers/${encodeURIComponent(providerId)}/keys/${encodeURIComponent(keyId)}`;

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
