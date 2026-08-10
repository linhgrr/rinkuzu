import { createMutableAiSettingsResourceHandlers } from '../../../../proxy';

type Params = { providerId: string; keyId: string };
const path = ({ providerId, keyId }: Params) =>
  `/admin/llm-settings/providers/${encodeURIComponent(providerId)}/keys/${encodeURIComponent(keyId)}`;

export const dynamic = 'force-dynamic';
const handlers = createMutableAiSettingsResourceHandlers<Params>(path);
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
