import { createAiSettingsHandler } from '../../proxy';

type Params = { providerId: string };
const path = ({ providerId }: Params) =>
  `/admin/llm-settings/providers/${encodeURIComponent(providerId)}`;

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
