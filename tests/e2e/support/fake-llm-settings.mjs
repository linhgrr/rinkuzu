const settingsByUserId = new Map();

const ACTIONS = [
  {
    action: 'ask_rin_chan',
    group: 'tutor',
    label: 'Rin-chan tutor',
    description: 'Interactive tutor response.',
    required_capabilities: ['text'],
  },
];

function sendJson(response, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    'content-type': 'application/json; charset=utf-8',
    ...headers,
  });
  response.end(body);
}

function stateFor(userId) {
  let state = settingsByUserId.get(userId);
  if (!state) {
    state = {
      credentials: [],
      models: [],
      providers: [],
      // Revisions are 1-based in the service contract: the proxy validates
      // `If-Match` against /^"llm-config-[1-9][0-9]*"$/, so a stub that starts
      // at 0 makes the very first mutation fail as a malformed header rather
      // than reaching the stub at all.
      revision: 1,
      routes: [{ action: 'ask_rin_chan', model_ids: [] }],
      secrets: new Map(),
    };
    settingsByUserId.set(userId, state);
  }
  return state;
}

function snapshot(state) {
  return {
    revision: state.revision,
    actions: ACTIONS,
    pipeline_steps: [],
    providers: state.providers,
    credentials: state.credentials,
    models: state.models,
    routes: state.routes,
    step_policies: [],
  };
}

function sendSuccess(response, state, data = {}) {
  sendJson(
    response,
    200,
    { success: true, data, meta: { revision: state.revision } },
    { etag: `"llm-config-${state.revision}"` },
  );
}

function sendError(response, status, code, message) {
  sendJson(response, status, { success: false, error: { code, message } });
}

function requireRevision(request, response, state) {
  const expected = `"llm-config-${state.revision}"`;
  if (request.headers['if-match'] !== expected) {
    sendError(response, 412, 'config_revision_conflict', 'Stale configuration revision');
    return false;
  }
  return true;
}

function providerOrigin(baseUrl) {
  const url = new URL(baseUrl);
  return url.origin;
}

function maskedKey(secret) {
  return `••••${secret.slice(-4)}`;
}

export async function handleFakeLlmSettingsRequest({
  readJsonBody,
  request,
  response,
  url,
  userId,
}) {
  const prefix = '/api/admin/llm-settings';
  if (!url.pathname.startsWith(prefix)) return false;

  const state = stateFor(userId);
  if (request.method === 'GET' && url.pathname === `${prefix}/snapshot`) {
    sendSuccess(response, state, snapshot(state));
    return true;
  }

  if (!requireRevision(request, response, state)) return true;
  const body = await readJsonBody(request);

  if (request.method === 'POST' && url.pathname === `${prefix}/providers`) {
    const provider = {
      provider_id: `provider-${state.providers.length + 1}`,
      name: body.name,
      provider_type: 'openai_compatible',
      base_url: body.base_url,
      normalized_origin: providerOrigin(body.base_url),
      enabled: body.enabled,
      timeout_sec: body.timeout_sec,
    };
    state.providers.push(provider);
    state.revision += 1;
    sendSuccess(response, state, provider);
    return true;
  }

  const keyCollectionMatch = url.pathname.match(
    /^\/api\/admin\/llm-settings\/providers\/([^/]+)\/keys$/,
  );
  if (request.method === 'POST' && keyCollectionMatch) {
    const providerId = decodeURIComponent(keyCollectionMatch[1]);
    if (!state.providers.some((provider) => provider.provider_id === providerId)) {
      sendError(response, 404, 'not_found', 'Provider not found');
      return true;
    }
    const key = {
      key_id: `key-${state.credentials.length + 1}`,
      provider_id: providerId,
      label: body.label,
      masked_key: maskedKey(body.api_key),
      priority: body.priority,
      enabled: body.enabled,
      secret_version: 1,
      health: null,
    };
    state.secrets.set(key.key_id, body.api_key);
    state.credentials.push(key);
    state.credentials.sort((left, right) => left.priority - right.priority);
    state.revision += 1;
    sendSuccess(response, state, key);
    return true;
  }

  const modelCollectionMatch = url.pathname.match(
    /^\/api\/admin\/llm-settings\/providers\/([^/]+)\/models$/,
  );
  if (request.method === 'POST' && modelCollectionMatch) {
    const providerId = decodeURIComponent(modelCollectionMatch[1]);
    if (!state.providers.some((provider) => provider.provider_id === providerId)) {
      sendError(response, 404, 'not_found', 'Provider not found');
      return true;
    }
    const model = {
      model_id: `model-${state.models.length + 1}`,
      provider_id: providerId,
      display_name: body.display_name,
      upstream_model_name: body.upstream_model_name,
      enabled: body.enabled,
      capabilities: body.capabilities,
      timeout_sec_override: body.timeout_sec_override,
      input_price_usd_per_m_tokens: body.input_price_usd_per_m_tokens,
      output_price_usd_per_m_tokens: body.output_price_usd_per_m_tokens,
    };
    state.models.push(model);
    state.revision += 1;
    sendSuccess(response, state, model);
    return true;
  }

  if (request.method === 'PUT' && url.pathname === `${prefix}/routing`) {
    const route = body.routes?.find((candidate) => candidate.action === 'ask_rin_chan');
    const modelIds = route?.model_ids ?? [];
    if (
      modelIds.length < 2 ||
      modelIds.some((modelId) => !state.models.some((model) => model.model_id === modelId))
    ) {
      sendError(response, 409, 'invalid_route', 'Tutor route requires two existing models');
      return true;
    }
    state.routes = body.routes;
    state.revision += 1;
    sendSuccess(response, state, { routes: state.routes, step_policies: [] });
    return true;
  }

  sendError(response, 404, 'not_found', `Unhandled fake LLM settings route: ${url.pathname}`);
  return true;
}

export function handleFakeLlmControlRequest(body, response, pathname) {
  if (pathname === '/__e2e/llm-settings/reset') {
    settingsByUserId.delete(body.userId);
    sendJson(response, 200, { success: true, data: { reset: true } });
    return true;
  }

  if (pathname === '/__e2e/llm-settings/simulate-fallback') {
    const state = settingsByUserId.get(body.userId);
    const route = state?.routes.find((candidate) => candidate.action === body.action);
    if (!state || !route || route.model_ids.length < 2) {
      sendError(response, 409, 'route_not_ready', 'Fallback route is not configured');
      return true;
    }
    sendJson(response, 200, {
      success: true,
      data: {
        operation_id: `e2e-operation-${body.userId}`,
        attempts: [
          { attempt_index: 1, model_id: route.model_ids[0], outcome: 'recoverable_failure' },
          { attempt_index: 2, model_id: route.model_ids[1], outcome: 'success' },
        ],
        selected_model_id: route.model_ids[1],
      },
    });
    return true;
  }

  return false;
}
