import { createAiSettingsHandler } from '../proxy';

export const dynamic = 'force-dynamic';
export const PUT = createAiSettingsHandler({
  method: 'PUT',
  path: '/admin/llm-settings/routing',
  forwardIfMatch: true,
});
