import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withLlmConfigAdmin } from '@/lib/api/auth';

type AiSettingsMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type RouteParams = Record<string, string | string[]>;

type HandlerDefinition<TParams extends RouteParams> = {
  method: AiSettingsMethod;
  path: string | ((params: TParams) => string);
  forwardIfMatch?: boolean;
};

/** Build one explicit, authenticated proxy handler for a fixed control-plane path. */
export function createAiSettingsHandler<TParams extends RouteParams = RouteParams>(
  definition: HandlerDefinition<TParams>,
) {
  return withLlmConfigAdmin<TParams>(async (request, { userId, session, params }) => {
    const targetPath =
      typeof definition.path === 'function' ? definition.path(params) : definition.path;
    const response = await proxyAdaptiveRequest(
      request,
      targetPath,
      { userId, userRole: session.user.role },
      {
        method: definition.method,
        forwardIfMatch: definition.forwardIfMatch,
      },
    );
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Pragma', 'no-cache');
    return response;
  });
}

/** Build the standard PATCH/DELETE pair used by mutable LLM settings resources. */
export function createMutableAiSettingsResourceHandlers<TParams extends RouteParams>(
  path: HandlerDefinition<TParams>['path'],
) {
  return {
    PATCH: createAiSettingsHandler<TParams>({ method: 'PATCH', path, forwardIfMatch: true }),
    DELETE: createAiSettingsHandler<TParams>({ method: 'DELETE', path, forwardIfMatch: true }),
  };
}
