import { createAiSettingsHandler } from './proxy';

export const dynamic = 'force-dynamic';
export const GET = createAiSettingsHandler({
  method: 'GET',
  path: '/admin/llm-settings/snapshot',
});
