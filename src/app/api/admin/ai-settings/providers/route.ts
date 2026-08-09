import { createAiSettingsHandler } from '../proxy';

export const dynamic = 'force-dynamic';
export const POST = createAiSettingsHandler({
  method: 'POST',
  path: '/admin/llm-settings/providers',
  forwardIfMatch: true,
});
