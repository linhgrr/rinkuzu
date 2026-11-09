import { createServer } from 'node:http';
import { HEADERS_TIMEOUT_MS, KEEP_ALIVE_TIMEOUT_MS } from './connection-timeouts.mjs';
import { handleFakeAskRinRequest } from './fake-ask-rin.mjs';
import { handleFakeLlmControlRequest, handleFakeLlmSettingsRequest } from './fake-llm-settings.mjs';
import { handleFakePersonalLearningRequest } from './fake-personal-learning.mjs';

const HOST = '127.0.0.1';
const PORT = Number(process.env['FAKE_ADAPTIVE_PORT'] ?? 8000);
const CONTROL_TOKEN = 'rinkuzu-e2e-control';
const MAX_BODY_BYTES = 1_000_000;
const statesByUserId = new Map();

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(body);
}

function sendOk(response, data) {
  sendJson(response, 200, { success: true, data });
}

function sendError(response, status, code, message) {
  sendJson(response, status, { success: false, error: { code, message } });
}

async function readJsonBody(request) {
  const chunks = [];
  let receivedBytes = 0;
  for await (const chunk of request) {
    receivedBytes += chunk.length;
    if (receivedBytes > MAX_BODY_BYTES) {
      throw new RangeError('Request body exceeds the E2E fake service limit');
    }
    chunks.push(chunk);
  }
  return chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function requireServiceAuth(request, response) {
  // Non-secret CI/test fixture; must match vitest/CI/perf/Docker fallbacks.
  const expectedToken =
    process.env['INTERNAL_SERVICE_TOKEN'] ?? 'rinkuzu-ci-fixture-0123456789abcdef-token';
  if (request.headers['x-service-token'] !== expectedToken) {
    sendError(response, 401, 'unauthorized', 'Missing or invalid service token');
    return null;
  }

  const userId = request.headers['x-user-id'];
  if (typeof userId !== 'string' || !/^[a-f\d]{24}$/i.test(userId)) {
    sendError(response, 401, 'unauthorized', 'Missing or invalid user context');
    return null;
  }
  return userId;
}

function requireControlAuth(request, response) {
  if (request.headers['x-e2e-control-token'] !== CONTROL_TOKEN) {
    sendError(response, 403, 'forbidden', 'Invalid E2E control token');
    return false;
  }
  return true;
}

function toJobListItem(state) {
  const now = Math.floor(Date.now() / 1000);
  const completed = state.status === 'completed';
  return {
    job_id: state.jobId,
    filename: state.filename,
    subject_id: state.subjectId,
    status: state.status,
    current_step: completed ? 'Completed' : 'Extracting concepts',
    progress: completed ? 1 : 0.45,
    page_batch_size: 10,
    batch_count: completed ? 1 : 0,
    failed_batch_count: 0,
    partial_success: false,
    concepts_extracted: completed ? 4 : 2,
    concepts_after_merge: completed ? 4 : 0,
    relations_verified: completed ? 3 : 0,
    error_code: null,
    user_message: null,
    retryable: false,
    retry_count: 0,
    eta_seconds: completed ? 0 : 2,
    created_at: state.createdAt,
    updated_at: now,
    heartbeat_at: now,
    completed_at: completed ? now : null,
    is_terminal: completed,
    is_delayed: false,
    retry_after_seconds: 1,
  };
}

function toCompletedSubject(state) {
  return {
    job_id: state.jobId,
    filename: state.filename,
    subject_id: state.subjectId,
    status: 'completed',
    concepts_extracted: 4,
    concepts_after_merge: 4,
    relations_verified: 3,
    completed_at: Math.floor(Date.now() / 1000),
    mastered_concept: 0,
    all_concept: 4,
    unlocked_concept: 4,
    locked_concept: 0,
    progress_percent: 0,
  };
}

function toSessionStatus(sessionId) {
  return {
    session_id: sessionId,
    status: 'active',
    step: 0,
    max_steps: 50,
    concepts_visited: 0,
    total_concepts: 4,
    unlocked_concepts: 4,
    locked_concepts: 0,
    mastered_concepts: 0,
    avg_mastery: 0,
    progress_percent: 0,
    coverage: 0,
    total_correct: 0,
    total_answered: 0,
    accuracy: 0,
    exercises: [],
  };
}

async function handleControlRequest(request, response, pathname) {
  if (!requireControlAuth(request, response)) return;
  const body = await readJsonBody(request);

  if (handleFakeLlmControlRequest(body, response, pathname)) return;

  if (request.method === 'POST' && pathname === '/__e2e/complete') {
    const state = statesByUserId.get(body.userId);
    if (!state) {
      sendError(response, 404, 'not_found', 'No adaptive E2E job exists for this user');
      return;
    }
    state.status = 'completed';
    sendOk(response, { job_id: state.jobId, status: state.status });
    return;
  }

  // The UI locales the BFF forwarded upstream, so a spec can check the web passes them (RIN-1267).
  if (request.method === 'POST' && pathname === '/__e2e/locales') {
    const state = statesByUserId.get(body.userId);
    sendOk(response, state?.forwardedLocales ?? {});
    return;
  }

  if (request.method === 'POST' && pathname === '/__e2e/reset') {
    statesByUserId.delete(body.userId);
    sendOk(response, { reset: true });
    return;
  }

  sendError(response, 404, 'not_found', 'Unknown E2E control route');
}

async function handleAdaptiveRequest(request, response, url) {
  const userId = requireServiceAuth(request, response);
  if (!userId) return;

  if (await handleFakeLlmSettingsRequest({ readJsonBody, request, response, url, userId })) {
    return;
  }
  if (handleFakePersonalLearningRequest({ request, response, sendError, sendOk, url })) return;
  if (await handleFakeAskRinRequest({ readJsonBody, request, response, sendError, sendOk, url })) {
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/ready') {
    sendOk(response, {
      status: 'ready',
      ready: true,
      mongo_available: true,
      models_enabled: true,
      models_loaded: true,
      content_pipeline_available: true,
      content_pipeline_service_ready: true,
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/pipeline/process') {
    const body = await readJsonBody(request);
    if (
      typeof body.filename !== 'string' ||
      typeof body.subject_id !== 'string' ||
      typeof body.source_s3_key !== 'string' ||
      typeof body.file_url !== 'string'
    ) {
      sendError(response, 400, 'validation_error', 'Invalid pipeline process payload');
      return;
    }

    const state = {
      createdAt: Math.floor(Date.now() / 1000),
      filename: body.filename,
      jobId: `e2e-job-${userId}`,
      sessionId: `e2e-session-${userId}`,
      status: 'extracting',
      subjectId: body.subject_id,
      forwardedLocales: { process: body.locale ?? null },
    };
    statesByUserId.set(userId, state);
    sendOk(response, {
      job_id: state.jobId,
      filename: state.filename,
      file_size: 16,
      subject_id: state.subjectId,
      status: 'queued',
      status_url: `/api/pipeline/jobs/${state.jobId}`,
      page_batch_size: 10,
      retry_after_seconds: 1,
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/personal-learning/subjects') {
    // Any learner gets one fixed subject; raw_text proves the BFF allowlist drops extras.
    sendOk(response, {
      subjects: [
        {
          job_id: `e2e-lookup-job-${url.searchParams.get('user_id')}`,
          filename: 'e2e-lookup-notes.pdf',
          pipeline_status: 'completed',
          progress_status: 'active',
          accuracy: 0.8,
          progress_percent: 50,
          last_activity_at: '2026-10-30T12:00:00Z',
          raw_text: 'E2E_RAW_DOCUMENT_TEXT',
        },
      ],
      next_cursor: null,
    });
    return;
  }

  const state = statesByUserId.get(userId);
  if (request.method === 'GET' && url.pathname === '/api/history/subjects') {
    const subjects = state?.status === 'completed' ? [toCompletedSubject(state)] : [];
    sendOk(response, { subjects, count: subjects.length });
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/history/subjects/progress') {
    sendOk(response, { subjects: [], count: 0 });
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/pipeline/jobs') {
    const jobs = state ? [toJobListItem(state)] : [];
    sendOk(response, { jobs, count: jobs.length });
    return;
  }

  // Path B review facts (RIN-1361/RIN-1364): every learner completed a document an hour ago.
  const reviewFactsMatch = url.pathname.match(/^\/api\/admin\/review-reminder\/adaptive\/([^/]+)$/);
  if (request.method === 'GET' && reviewFactsMatch) {
    sendOk(response, {
      latest_completion: {
        completed_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        document_id: 'e2e-review-session',
        job_id: 'e2e-review-job',
        document_title: 'E2E notes.pdf',
        due_count: 2,
      },
      completions_after: [],
    });
    return;
  }

  const createSessionMatch = url.pathname.match(/^\/api\/pipeline\/jobs\/([^/]+)\/create-session$/);
  if (request.method === 'POST' && createSessionMatch) {
    if (!state || createSessionMatch[1] !== state.jobId || state.status !== 'completed') {
      sendError(response, 409, 'conflict', 'Pipeline job is not ready');
      return;
    }
    state.forwardedLocales.createSession = url.searchParams.get('locale');
    sendOk(response, {
      session_id: state.sessionId,
      n_concepts: 4,
      source: 'new_session',
      job_id: state.jobId,
      status: 'active',
    });
    return;
  }

  const sessionStatusMatch = url.pathname.match(/^\/api\/session\/([^/]+)\/status$/);
  if (request.method === 'GET' && sessionStatusMatch) {
    if (!state || sessionStatusMatch[1] !== state.sessionId) {
      sendError(response, 404, 'not_found', 'Session not found');
      return;
    }
    sendOk(response, toSessionStatus(state.sessionId));
    return;
  }

  const sessionGraphMatch = url.pathname.match(/^\/api\/session\/([^/]+)\/graph$/);
  if (request.method === 'GET' && sessionGraphMatch) {
    if (!state || sessionGraphMatch[1] !== state.sessionId) {
      sendError(response, 404, 'not_found', 'Session not found');
      return;
    }
    sendOk(response, {
      nodes: [
        {
          id: 'concept-1',
          index: 0,
          name: state.subjectId,
          mastery: 0,
          status: 'available',
          visited: false,
        },
      ],
      edges: [],
    });
    return;
  }

  sendError(response, 404, 'not_found', `Unhandled fake adaptive route: ${url.pathname}`);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);
    if (request.method === 'GET' && url.pathname === '/__e2e/health') {
      sendOk(response, { ready: true });
      return;
    }
    if (url.pathname.startsWith('/__e2e/')) {
      await handleControlRequest(request, response, url.pathname);
      return;
    }
    await handleAdaptiveRequest(request, response, url);
  } catch (error) {
    const invalidInput = error instanceof SyntaxError || error instanceof RangeError;
    sendError(
      response,
      invalidInput ? 400 : 500,
      invalidInput ? 'validation_error' : 'internal_error',
      error instanceof Error ? error.message : 'Unknown fake adaptive service error',
    );
  }
});

// Held open for longer than any gap between calls in the suite; see the module
// these come from for the ECONNRESET race they exist to remove.
server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
server.headersTimeout = HEADERS_TIMEOUT_MS;

server.listen(PORT, HOST, () => {
  process.stdout.write(`Fake adaptive service listening on http://${HOST}:${PORT}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close((error) => {
      process.exitCode = error ? 1 : 0;
    });
  });
}
