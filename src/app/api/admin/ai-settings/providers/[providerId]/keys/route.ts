import { createAiSettingsHandler } from '../../../proxy';

type Params = { providerId: string };
export const dynamic = 'force-dynamic';
export const POST = createAiSettingsHandler<Params>({
  method: 'POST',
  path: ({ providerId }) => `/admin/llm-settings/providers/${encodeURIComponent(providerId)}/keys`,
  forwardIfMatch: true,
});
