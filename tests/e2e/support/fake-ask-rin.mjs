import { createHash } from 'node:crypto';

/**
 * Stand-in for rinkuzu-ai-api's Ask Rin-chan routes (RIN-1202): register an exercise
 * context, read its (empty) conversation, and run the AG-UI agent as an SSE stream.
 *
 * The agent run emits the event order of `api/domains/assistant/agui.py` for a fresh
 * turn: RUN_STARTED, STATE_SNAPSHOT, TEXT_MESSAGE_START, TEXT_MESSAGE_CONTENT (one per
 * delta), TEXT_MESSAGE_END, RUN_FINISHED. The reply quotes the learner's question, so a
 * spec can tell the rendered answer came from this run and not from a canned string.
 */
const CONTEXTS_PATH = '/api/ask-rin-chan/contexts';
const AGENT_PATH = '/api/ask-rin-chan/agent';
const CONVERSATION_PATH = /^\/api\/ask-rin-chan\/conversations\/([^/]+)$/;
const DELTA_GAP_MS = 40;
const tokensByContextId = new Map();

function contextIdFor(body) {
  const digest = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  return `quiz:${digest.slice(0, 32)}`;
}

function latestUserText(messages) {
  const latest = [...messages].reverse().find((message) => message?.role === 'user');
  if (typeof latest?.content === 'string') return latest.content.trim();
  if (Array.isArray(latest?.content)) {
    return latest.content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }
  return '';
}

function encodeEvent(event) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

async function streamAgentRun(response, body, userText) {
  const { threadId, runId } = body;
  const messageId = `e2e-assistant-${runId}`;
  const deltas = ['Rin-chan read your question: ', `"${userText}". `, 'Start from the stem.'];

  response.writeHead(200, {
    'cache-control': 'no-cache',
    'content-type': 'text/event-stream',
    'x-accel-buffering': 'no',
  });
  response.write(encodeEvent({ type: 'RUN_STARTED', threadId, runId }));
  response.write(
    encodeEvent({
      type: 'STATE_SNAPSHOT',
      snapshot: { conversationId: `e2e-conversation-${threadId}`, exerciseContextId: threadId },
    }),
  );
  response.write(encodeEvent({ type: 'TEXT_MESSAGE_START', messageId, role: 'assistant' }));
  for (const delta of deltas) {
    await new Promise((resolve) => setTimeout(resolve, DELTA_GAP_MS));
    response.write(encodeEvent({ type: 'TEXT_MESSAGE_CONTENT', messageId, delta }));
  }
  response.write(encodeEvent({ type: 'TEXT_MESSAGE_END', messageId }));
  response.end(
    encodeEvent({
      type: 'RUN_FINISHED',
      threadId,
      runId,
      result: { conversationId: `e2e-conversation-${threadId}`, assistantMessageId: messageId },
    }),
  );
}

/** Handles an Ask Rin-chan route; resolves false for any other path. */
export async function handleFakeAskRinRequest({
  readJsonBody,
  request,
  response,
  sendError,
  sendOk,
  url,
}) {
  if (request.method === 'POST' && url.pathname === CONTEXTS_PATH) {
    const body = await readJsonBody(request);
    if (body.source !== 'quiz' || typeof body.question !== 'string') {
      sendError(response, 400, 'validation_error', 'Only quiz contexts are faked');
      return true;
    }
    const exerciseContextId = contextIdFor(body);
    const exerciseContextToken = `e2e-context-token-${createHash('sha256').update(exerciseContextId).digest('hex')}`;
    tokensByContextId.set(exerciseContextId, exerciseContextToken);
    sendOk(response, { exerciseContextId, exerciseContextToken });
    return true;
  }

  if (request.method === 'GET' && CONVERSATION_PATH.test(url.pathname)) {
    sendOk(response, null);
    return true;
  }

  if (request.method === 'POST' && url.pathname === AGENT_PATH) {
    const body = await readJsonBody(request);
    const expectedToken = tokensByContextId.get(body.threadId);
    const userText = Array.isArray(body.messages) ? latestUserText(body.messages) : '';
    if (!expectedToken || body.forwardedProps?.exerciseContextToken !== expectedToken) {
      sendError(response, 403, 'ask_rin_context_invalid', 'Unknown exercise context');
      return true;
    }
    if (typeof body.runId !== 'string' || !userText) {
      sendError(response, 400, 'validation_error', 'Invalid AG-UI run input');
      return true;
    }
    await streamAgentRun(response, body, userText);
    return true;
  }

  return false;
}
