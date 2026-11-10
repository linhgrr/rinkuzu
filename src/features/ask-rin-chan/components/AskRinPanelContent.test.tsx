/** @vitest-environment jsdom */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AskRinContextPayload } from '@/lib/ask-rin-chan/client';
import { AskRinPanelContent } from './AskRinPanelContent';

const mocks = vi.hoisted(() => ({
  fetchAskRinAgent: vi.fn(),
  getAskRinConversation: vi.fn(),
  registerAskRinContext: vi.fn(),
  locale: 'vi',
}));

// Stable `t` per namespace: the panel's hooks list it as an effect/memo dependency.
const translators = new Map<string, (key: string) => string>();
vi.mock('next-intl', () => ({
  useTranslations: (namespace = '') => {
    let translate = translators.get(namespace);
    if (!translate) {
      translate = (key: string) => `${namespace ? `${namespace}.` : ''}${key}`;
      translators.set(namespace, translate);
    }
    return translate;
  },
  useLocale: () => mocks.locale,
}));

vi.mock('@/lib/ask-rin-chan/client', () => ({
  registerAskRinContext: mocks.registerAskRinContext,
  getAskRinConversation: mocks.getAskRinConversation,
  deleteAskRinConversation: vi.fn(async () => undefined),
}));

vi.mock('@/lib/ask-rin-chan/agui-fetch', () => ({
  fetchAskRinAgent: mocks.fetchAskRinAgent,
}));

const QUIZ_CONTEXT: AskRinContextPayload = {
  source: 'quiz',
  question: 'What is 2 + 2?',
  options: ['3', '4'],
  optionImages: [],
};
const THINKING = 'adaptiveLearning.chatbot.thinking';
const RUN_FAILED = 'adaptiveLearning.chatbot.errorRunFailed';
const PLACEHOLDER = 'adaptiveLearning.chatbot.placeholder';
const SEND = 'adaptiveLearning.chatbot.send';
const RETRY = 'adaptiveLearning.chatbot.retryMessage';
const EMPTY_TITLE = 'adaptiveLearning.chatbot.emptyTitle';
// The first render in a worker is cold and can take over 1 s under gate contention.
const SLOW = { timeout: 5_000 };

interface SseRun {
  send: (event: Record<string, unknown>) => void;
  close: () => void;
}

/** Queues one AG-UI SSE response whose events the test pushes by hand. */
function queueSseRun(): SseRun {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
    },
  });
  mocks.fetchAskRinAgent.mockImplementationOnce(async (_url: string, init: RequestInit) => {
    init.signal?.addEventListener('abort', () => {
      try {
        controller.error(new DOMException('The operation was aborted.', 'AbortError'));
      } catch {
        // Stream already closed.
      }
    });
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  });
  return {
    send: (event) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)),
    close: () => controller.close(),
  };
}

async function openPanelAndAsk(question: string) {
  render(<AskRinPanelContent isOpen onClose={() => undefined} context={QUIZ_CONTEXT} />);
  const input = await screen.findByLabelText(PLACEHOLDER, {}, SLOW);
  // The composer renders before the AG-UI runtime's mount effects run. A click in that
  // window hits a still-disabled Send button and is silently dropped (RIN-928), so wait
  // for the runtime to load the (empty) history first, as a learner does.
  await waitFor(() => {
    expect(mocks.getAskRinConversation).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('common.loading')).toBeNull();
  }, SLOW);
  await ask(input, question);
}

async function ask(input: HTMLElement, question: string) {
  fireEvent.change(input, { target: { value: question } });
  await waitFor(
    () => expect((screen.getByLabelText(SEND) as HTMLButtonElement).disabled).toBe(false),
    SLOW,
  );
  fireEvent.click(screen.getByLabelText(SEND));
  // The sent message in the thread, not the composer's own copy of the text: a controlled
  // textarea also exposes its value as text content.
  await screen.findByText(question, { ignore: 'textarea, script, style' }, SLOW);
}

function startAssistantMessage(run: SseRun, runId: string) {
  run.send({ type: 'RUN_STARTED', threadId: 'ctx-test-1', runId });
  run.send({ type: 'TEXT_MESSAGE_START', messageId: `assistant-${runId}`, role: 'assistant' });
}

function failRun(run: SseRun, runId: string) {
  run.send({ type: 'TEXT_MESSAGE_END', messageId: `assistant-${runId}` });
  run.send({ type: 'RUN_ERROR', message: 'provider timeout', code: 'ask_rin_run_failed' });
  run.close();
}

function assistantBubbles() {
  return document.querySelectorAll('[data-message-id^="assistant-"]');
}

describe('AskRinPanelContent run states', () => {
  beforeEach(() => {
    mocks.fetchAskRinAgent.mockReset();
    mocks.getAskRinConversation.mockReset();
    mocks.getAskRinConversation.mockResolvedValue({ messages: [] });
    mocks.registerAskRinContext.mockReset();
    mocks.registerAskRinContext.mockResolvedValue({
      exerciseContextId: 'ctx-test-1',
      exerciseContextToken: 'fake-context-token',
    });
    mocks.locale = 'vi';
    HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
    // The thread viewport auto-scrolls with ResizeObserver and scrollTo, which jsdom lacks.
    HTMLElement.prototype.scrollTo = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['vi', 'en'])(
    'registers the context with the UI locale %s so replies follow it (RIN-1270)',
    async (locale) => {
      mocks.locale = locale;
      render(<AskRinPanelContent isOpen onClose={() => undefined} context={QUIZ_CONTEXT} />);
      await waitFor(() => expect(mocks.registerAskRinContext).toHaveBeenCalledTimes(1), SLOW);
      expect(mocks.registerAskRinContext).toHaveBeenCalledWith({ ...QUIZ_CONTEXT, locale });
    },
  );

  it('registers a new context when the UI locale changes (RIN-1270)', async () => {
    const view = render(
      <AskRinPanelContent isOpen onClose={() => undefined} context={QUIZ_CONTEXT} />,
    );
    await waitFor(() => expect(mocks.registerAskRinContext).toHaveBeenCalledTimes(1), SLOW);
    mocks.locale = 'en';
    view.rerender(<AskRinPanelContent isOpen onClose={() => undefined} context={QUIZ_CONTEXT} />);
    await waitFor(() => expect(mocks.registerAskRinContext).toHaveBeenCalledTimes(2), SLOW);
    expect(mocks.registerAskRinContext).toHaveBeenLastCalledWith({ ...QUIZ_CONTEXT, locale: 'en' });
  });

  it('shows the thinking bubble while Rin-chan is streaming', async () => {
    const run = queueSseRun();
    await openPanelAndAsk('Why is it 4?');

    await act(async () => startAssistantMessage(run, 'run-1'));

    expect(await screen.findByText(THINKING, {}, SLOW)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('streams a full answer in the event sequence the API sends (RIN-1195)', async () => {
    const run = queueSseRun();
    await openPanelAndAsk('Why is it 4?');

    const [, init] = mocks.fetchAskRinAgent.mock.calls[0] ?? [];
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toMatchObject({
      threadId: 'ctx-test-1',
      protocolVersion: '1.0',
      forwardedProps: { exerciseContextToken: 'fake-context-token' },
    });

    // Same events, fields and order as rinkuzu-ai-api's assistant/agui.py.
    await act(async () => {
      startAssistantMessage(run, 'run-1');
      run.send({
        type: 'STATE_SNAPSHOT',
        snapshot: { conversationId: 'conv-1', exerciseContextId: 'ctx-test-1' },
      });
      run.send({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'assistant-run-1', delta: 'Two plus ' });
      run.send({
        type: 'TEXT_MESSAGE_CONTENT',
        messageId: 'assistant-run-1',
        delta: 'two is four.',
      });
      run.send({ type: 'TEXT_MESSAGE_END', messageId: 'assistant-run-1' });
      run.send({
        type: 'RUN_FINISHED',
        threadId: 'ctx-test-1',
        runId: 'run-1',
        result: { conversationId: 'conv-1' },
      });
      run.close();
    });

    expect(await screen.findByText('Two plus two is four.', {}, SLOW)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(THINKING)).toBeNull(), SLOW);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('removes the thinking bubble and shows only the error card when the stream reports RUN_ERROR', async () => {
    const run = queueSseRun();
    await openPanelAndAsk('Why is it 4?');
    await act(async () => startAssistantMessage(run, 'run-1'));
    await screen.findByText(THINKING, {}, SLOW);

    // The API's failure contract: close the text message, then RUN_ERROR ask_rin_run_failed.
    await act(async () => failRun(run, 'run-1'));

    const alert = await screen.findByRole('alert', {}, SLOW);
    expect(alert.textContent).toContain(RUN_FAILED);
    expect(screen.queryByText(THINKING)).toBeNull();
    expect(assistantBubbles()).toHaveLength(0);
  });

  it('brings the bubble back and clears the error when the learner asks again', async () => {
    const failed = queueSseRun();
    await openPanelAndAsk('Why is it 4?');
    await act(async () => startAssistantMessage(failed, 'run-1'));
    await act(async () => failRun(failed, 'run-1'));
    await screen.findByRole('alert', {}, SLOW);
    expect(screen.queryByText(THINKING)).toBeNull();

    const retry = queueSseRun();
    await ask(screen.getByLabelText(PLACEHOLDER), 'Please try again');
    await act(async () => startAssistantMessage(retry, 'run-2'));

    expect(await screen.findByText(THINKING, {}, SLOW)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('resends the same question once when the learner taps Retry after a failed run', async () => {
    const failed = queueSseRun();
    await openPanelAndAsk('Why is it 4?');
    await act(async () => startAssistantMessage(failed, 'run-1'));
    await act(async () => failRun(failed, 'run-1'));
    await screen.findByRole('alert', {}, SLOW);

    const retry = queueSseRun();
    fireEvent.click(await screen.findByRole('button', { name: RETRY }, SLOW));
    await act(async () => startAssistantMessage(retry, 'run-2'));

    expect(await screen.findByText(THINKING, {}, SLOW)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: RETRY })).toBeNull();
    expect(mocks.fetchAskRinAgent).toHaveBeenCalledTimes(2);
    const body = JSON.parse(String(mocks.fetchAskRinAgent.mock.calls[1]?.[1]?.body)) as {
      messages: { role: string; content: string }[];
    };
    const userMessages = body.messages.filter((message) => message.role === 'user');
    expect(userMessages.map((message) => message.content)).toEqual(['Why is it 4?']);
    expect(screen.getAllByText('Why is it 4?', { ignore: 'textarea, script, style' })).toHaveLength(
      1,
    );
  });

  it('offers Retry when the daily limit is reported', async () => {
    const run = queueSseRun();
    await openPanelAndAsk('Why is it 4?');
    await act(async () => {
      startAssistantMessage(run, 'run-1');
      run.send({ type: 'TEXT_MESSAGE_END', messageId: 'assistant-run-1' });
      run.send({ type: 'RUN_ERROR', message: 'limit', code: 'quota_exceeded' });
      run.close();
    });

    const alert = await screen.findByRole('alert', {}, SLOW);
    expect(alert.textContent).toContain('adaptiveLearning.chatbot.errorQuota');
    expect(await screen.findByRole('button', { name: RETRY }, SLOW)).toBeTruthy();
  });

  it('offers no Retry while an answer is still streaming', async () => {
    const run = queueSseRun();
    await openPanelAndAsk('Why is it 4?');
    await act(async () => startAssistantMessage(run, 'run-1'));
    await screen.findByText(THINKING, {}, SLOW);

    expect(screen.queryByRole('button', { name: RETRY })).toBeNull();
  });

  it('keeps a question sent while the history is still loading (RIN-1207)', async () => {
    let releaseHistory!: (conversation: unknown) => void;
    mocks.getAskRinConversation.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseHistory = resolve;
      }),
    );
    const run = queueSseRun();
    render(<AskRinPanelContent isOpen onClose={() => undefined} context={QUIZ_CONTEXT} />);
    const input = await screen.findByLabelText(PLACEHOLDER, {}, SLOW);
    await waitFor(() => expect(mocks.getAskRinConversation).toHaveBeenCalledTimes(1), SLOW);

    // A learner on a slow network types and sends before the history response lands.
    fireEvent.change(input, { target: { value: 'Why is it 4?' } });
    // The runtime holds the send until the history import finishes (assistant-ui 0.15).
    await waitFor(
      () => expect((screen.getByLabelText(SEND) as HTMLButtonElement).disabled).toBe(false),
      SLOW,
    );
    fireEvent.click(screen.getByLabelText(SEND));
    expect(screen.getByLabelText('common.loading')).toBeTruthy();

    await act(async () =>
      releaseHistory({
        messages: [
          { messageId: 'history-user-1', role: 'user', content: 'Earlier question' },
          { messageId: 'history-assistant-1', role: 'assistant', content: 'Earlier answer' },
        ],
      }),
    );

    expect(await screen.findByText('Earlier answer', {}, SLOW)).toBeTruthy();
    expect(
      await screen.findByText('Why is it 4?', { ignore: 'textarea, script, style' }, SLOW),
    ).toBeTruthy();
    await act(async () => startAssistantMessage(run, 'run-1'));
    expect(await screen.findByText(THINKING, {}, SLOW)).toBeTruthy();
    const body = JSON.parse(String(mocks.fetchAskRinAgent.mock.calls[0]?.[1]?.body)) as {
      messages: { role: string; content: string }[];
    };
    // History first, the pending question after it.
    expect(body.messages.map((message) => message.content)).toEqual([
      'Earlier question',
      'Earlier answer',
      'Why is it 4?',
    ]);
  });

  it('never shows the empty state before the history has loaded (RIN-1207)', async () => {
    let releaseHistory!: (conversation: unknown) => void;
    mocks.getAskRinConversation.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseHistory = resolve;
      }),
    );
    // Record every node ever inserted: a one-commit flash is replaced before any assertion.
    const inserted: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => inserted.push(node.textContent ?? ''));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    render(<AskRinPanelContent isOpen onClose={() => undefined} context={QUIZ_CONTEXT} />);
    await screen.findByLabelText(PLACEHOLDER, {}, SLOW);
    await waitFor(() => expect(mocks.getAskRinConversation).toHaveBeenCalledTimes(1), SLOW);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const insertedWhileLoading = [
      ...inserted,
      ...observer
        .takeRecords()
        .flatMap((record) => [...record.addedNodes].map((node) => node.textContent ?? '')),
    ];

    expect(insertedWhileLoading.some((text) => text.includes(EMPTY_TITLE))).toBe(false);
    expect(screen.getByLabelText('common.loading')).toBeTruthy();

    await act(async () => releaseHistory({ messages: [] }));
    observer.disconnect();
    expect(await screen.findByText(EMPTY_TITLE, {}, SLOW)).toBeTruthy();
  });

  it('shows neither the bubble nor an error after the learner stops the answer', async () => {
    const run = queueSseRun();
    await openPanelAndAsk('Why is it 4?');
    await act(async () => startAssistantMessage(run, 'run-1'));
    await screen.findByText(THINKING, {}, SLOW);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('adaptiveLearning.chatbot.stop'));
    });

    await screen.findByLabelText(SEND, {}, SLOW);
    await waitFor(() => expect(screen.queryByText(THINKING)).toBeNull());
    expect(assistantBubbles()).toHaveLength(0);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
