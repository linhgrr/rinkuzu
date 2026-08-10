import { createMutableAiSettingsResourceHandlers } from '../../proxy';

type Params = { providerId: string };
const path = ({ providerId }: Params) =>
  `/admin/llm-settings/providers/${encodeURIComponent(providerId)}`;

export const dynamic = 'force-dynamic';
const handlers = createMutableAiSettingsResourceHandlers<Params>(path);
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
