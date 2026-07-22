'use client';

import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ExportedMessageRepository,
  MessagePrimitive,
  ThreadPrimitive,
  useAssistantRuntime,
  useAuiState,
  type EmptyMessagePartProps,
  type TextMessagePartProps,
  type ThreadHistoryAdapter,
} from '@assistant-ui/react';
import { HttpAgent } from '@ag-ui/client';
import { fromAgUiMessages, useAgUiRuntime } from '@assistant-ui/react-ag-ui';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  HiArrowUp,
  HiOutlineExclamationCircle,
  HiOutlineStop,
  HiOutlineTrash,
} from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { DynamicMarkdownRenderer as MarkdownRenderer } from '@/components/ui/DynamicMarkdownRenderer';
import { Modal } from '@/components/ui/Modal';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import {
  deleteAskRinConversation,
  getAskRinConversation,
  registerAskRinContext,
  type AskRinContextCredentials,
  type AskRinContextPayload,
} from '@/lib/ask-rin-chan/client';
import { fetchAskRinAgent } from '@/lib/ask-rin-chan/agui-fetch';
import { getAskRinPublicErrorKey } from '@/lib/ask-rin-chan/public-error';
import { isAwaitingFirstAssistantText } from '@/lib/ask-rin-chan/stream-state';

const CHATBOT_ICON = '/images/chatbot_icon.png';

interface AskRinHistorySummary {
  totalMessages: number;
  totalTurns: number;
}

interface AskRinPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context: AskRinContextPayload;
  contextPreview?: ReactNode;
  onHistoryChange?: (summary: AskRinHistorySummary) => void;
}

interface AskRinRuntimeProps {
  credentials: AskRinContextCredentials;
  contextPreview?: ReactNode;
  onHistoryChange?: (summary: AskRinHistorySummary) => void;
}

function ThinkingIndicator() {
  const t = useTranslations('adaptiveLearning.chatbot');
  return (
    <div className="flex items-center gap-2 text-sm text-neutral-500" aria-label={t('thinking')}>
      <span className="size-2 animate-pulse rounded-full bg-brand-trust" />
      <span>{t('thinking')}</span>
    </div>
  );
}

function AskRinText({ text, status }: TextMessagePartProps) {
  const role = useAuiState((state) => state.message.role);
  if (isAwaitingFirstAssistantText(role, text, status.type)) {
    return <ThinkingIndicator />;
  }
  if (role === 'assistant') {
    return <MarkdownRenderer content={text} className="text-sm leading-6 text-neutral-800" />;
  }
  return <p className="whitespace-pre-wrap text-sm leading-6">{text}</p>;
}

function ThinkingMessage(_props: EmptyMessagePartProps) {
  return <ThinkingIndicator />;
}

function AskRinMessage() {
  const role = useAuiState((state) => state.message.role);
  const isUser = role === 'user';

  return (
    <MessagePrimitive.Root className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          isUser
            ? 'max-w-[86%] rounded-2xl rounded-br-md bg-neutral-900 px-4 py-2.5 text-white'
            : 'max-w-[92%] rounded-2xl rounded-bl-md border border-neutral-200 bg-white px-4 py-3 shadow-sm'
        }
      >
        <MessagePrimitive.Parts components={{ Text: AskRinText, Empty: ThinkingMessage }} />
      </div>
    </MessagePrimitive.Root>
  );
}

function EmptyConversation() {
  const t = useTranslations('adaptiveLearning.chatbot');
  const runtime = useAssistantRuntime();
  const suggestions = [t('suggestExplain'), t('suggestHint'), t('suggestSteps')];

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-10 text-center">
      <Image
        src={CHATBOT_ICON}
        alt={t('iconAlt')}
        width={64}
        height={64}
        className="mb-4 size-16 object-contain"
      />
      <h3 className="text-base font-semibold text-neutral-900">{t('emptyTitle')}</h3>
      <p className="mt-2 text-sm leading-6 text-neutral-500">{t('initialGreeting')}</p>
      <div className="mt-5 grid w-full gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => runtime.thread.append(suggestion)}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm text-neutral-700 transition-colors hover:border-green-300 hover:bg-green-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-trust"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function AskRinThread({
  credentials,
  contextPreview,
  error,
  onError,
  onHistoryReset,
}: Omit<AskRinRuntimeProps, 'onHistoryChange'> & {
  error: string;
  onError: (message: string) => void;
  onHistoryReset: () => void;
}) {
  const t = useTranslations('adaptiveLearning.chatbot');
  const tCommon = useTranslations('common');
  const runtime = useAssistantRuntime();
  const messages = useAuiState((state) => state.thread.messages);
  const isRunning = useAuiState((state) => state.thread.isRunning);
  const isLoading = useAuiState((state) => state.thread.isLoading);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    return () => {
      if (runtime.thread.getState().isRunning) runtime.thread.cancelRun();
    };
  }, [runtime]);

  const clearConversation = async () => {
    if (clearing || isRunning) return;
    setClearing(true);
    onError('');
    try {
      await deleteAskRinConversation(credentials.exerciseContextId);
      runtime.thread.reset();
      onHistoryReset();
    } catch (clearError: unknown) {
      onError(extractUnknownErrorMessage(clearError, t('errorClear')));
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex h-[min(760px,calc(100dvh-2rem))] min-h-0 flex-col">
      <header className="border-b border-neutral-100 px-5 py-4 pr-16 sm:px-6 sm:pr-16">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src={CHATBOT_ICON}
              alt={t('iconAlt')}
              width={40}
              height={40}
              className="size-10 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-neutral-900">{t('title')}</h2>
              <p className="truncate text-xs text-neutral-500">{t('subtitle')}</p>
            </div>
          </div>
          {messages.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void clearConversation()}
              disabled={clearing || isRunning}
              className="shrink-0 gap-1.5 text-neutral-500 hover:bg-red-50 hover:text-red-600"
            >
              <HiOutlineTrash className="size-4" />
              <span className="hidden sm:inline">{t('clearHistory')}</span>
            </Button>
          ) : null}
        </div>
      </header>

      {contextPreview ? (
        <details className="group border-b border-neutral-100 bg-neutral-50/80 px-5 py-3 sm:px-6">
          <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500 marker:text-neutral-400">
            {t('contextQuestion')}
          </summary>
          <div className="mt-3 max-h-40 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-700">
            {contextPreview}
          </div>
        </details>
      ) : null}

      <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col bg-neutral-50/60">
        <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {isLoading ? (
            <div className="space-y-4" aria-label={tCommon('loading')}>
              <div className="h-16 w-3/4 animate-pulse rounded-2xl bg-neutral-200" />
              <div className="ml-auto h-12 w-1/2 animate-pulse rounded-2xl bg-neutral-200" />
            </div>
          ) : (
            <>
              <ThreadPrimitive.Empty>
                <EmptyConversation />
              </ThreadPrimitive.Empty>
              <div className="space-y-4">
                <ThreadPrimitive.Messages components={{ Message: AskRinMessage }} />
              </div>
            </>
          )}
        </ThreadPrimitive.Viewport>

        {error ? (
          <div
            role="alert"
            className="mx-4 mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 sm:mx-6"
          >
            <HiOutlineExclamationCircle className="mt-0.5 size-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="border-t border-neutral-100 bg-white p-4 sm:px-6">
          <ComposerPrimitive.Root className="flex items-end gap-2 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm transition focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-100">
            <ComposerPrimitive.Input
              autoFocus
              maxLength={1000}
              placeholder={t('placeholder')}
              className="max-h-32 min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-5 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-transparent focus:ring-0"
              aria-label={t('placeholder')}
            />
            <ThreadPrimitive.If running={false}>
              <ComposerPrimitive.Send
                aria-label={t('send')}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
              >
                <HiArrowUp className="size-4" />
              </ComposerPrimitive.Send>
            </ThreadPrimitive.If>
            <ThreadPrimitive.If running>
              <ComposerPrimitive.Cancel
                aria-label={t('stop')}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white transition hover:bg-neutral-800"
              >
                <HiOutlineStop className="size-4" />
              </ComposerPrimitive.Cancel>
            </ThreadPrimitive.If>
          </ComposerPrimitive.Root>
          <p className="mt-2 text-center text-[11px] text-neutral-400">{t('composerHint')}</p>
        </div>
      </ThreadPrimitive.Root>
    </div>
  );
}

function AskRinRuntime({ credentials, contextPreview, onHistoryChange }: AskRinRuntimeProps) {
  const t = useTranslations('adaptiveLearning.chatbot');
  const historyErrorLabel = t('errorHistory');
  const interruptedLabel = t('errorInterrupted');
  const [error, setError] = useState('');
  const historyCallbackRef = useRef(onHistoryChange);
  const historySummaryRef = useRef<AskRinHistorySummary>({ totalMessages: 0, totalTurns: 0 });

  useEffect(() => {
    historyCallbackRef.current = onHistoryChange;
  }, [onHistoryChange]);

  const agent = useMemo(() => {
    const nextAgent = new HttpAgent({
      url: '/api/ask-rin-chan/agent',
      threadId: credentials.exerciseContextId,
      fetch: fetchAskRinAgent,
    });
    nextAgent.use((input, next) =>
      next.run({
        ...input,
        forwardedProps: {
          exerciseContextToken: credentials.exerciseContextToken,
        },
      }),
    );
    return nextAgent;
  }, [credentials.exerciseContextId, credentials.exerciseContextToken]);

  const history = useMemo<ThreadHistoryAdapter>(
    () => ({
      load: async () => {
        try {
          const conversation = await getAskRinConversation(credentials.exerciseContextId);
          const messages = conversation?.messages ?? [];
          const totalTurns = messages.filter((message) => message.role === 'user').length;
          const summary = { totalMessages: messages.length, totalTurns };
          historySummaryRef.current = summary;
          historyCallbackRef.current?.(summary);
          setError('');
          return ExportedMessageRepository.fromArray(
            fromAgUiMessages(
              messages.map((message) => ({
                id: message.messageId,
                role: message.role,
                content:
                  message.status === 'interrupted' && message.role === 'assistant'
                    ? `${message.content}\n\n${interruptedLabel}`
                    : message.content,
              })),
            ),
          );
        } catch (historyError: unknown) {
          setError(extractUnknownErrorMessage(historyError, historyErrorLabel));
          return ExportedMessageRepository.fromArray([]);
        }
      },
      append: async ({ message }) => {
        // The backend persists the complete turn atomically by AG-UI run id.
        const current = historySummaryRef.current;
        const summary = {
          totalMessages: current.totalMessages + 1,
          totalTurns: current.totalTurns + (message.role === 'user' ? 1 : 0),
        };
        historySummaryRef.current = summary;
        historyCallbackRef.current?.(summary);
      },
    }),
    [credentials.exerciseContextId, historyErrorLabel, interruptedLabel],
  );

  const runtime = useAgUiRuntime({
    agent,
    adapters: { history },
    onError: (runError) => {
      setError(t(getAskRinPublicErrorKey(runError)));
    },
  });

  const resetHistorySummary = () => {
    const summary = { totalMessages: 0, totalTurns: 0 };
    historySummaryRef.current = summary;
    historyCallbackRef.current?.(summary);
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AskRinThread
        credentials={credentials}
        contextPreview={contextPreview}
        onHistoryReset={resetHistorySummary}
        error={error}
        onError={setError}
      />
    </AssistantRuntimeProvider>
  );
}

function AskRinRegistration({
  serializedContext,
  contextPreview,
  onHistoryChange,
}: {
  serializedContext: string;
  contextPreview?: ReactNode;
  onHistoryChange?: (summary: AskRinHistorySummary) => void;
}) {
  const t = useTranslations('adaptiveLearning.chatbot');
  const [credentials, setCredentials] = useState<AskRinContextCredentials | null>(null);
  const [registrationError, setRegistrationError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const payload = JSON.parse(serializedContext) as AskRinContextPayload;
    void registerAskRinContext(payload)
      .then((nextCredentials) => {
        if (active) setCredentials(nextCredentials);
      })
      .catch((contextError: unknown) => {
        if (active) {
          setRegistrationError(t(getAskRinPublicErrorKey(contextError)));
        }
      });
    return () => {
      active = false;
    };
  }, [attempt, serializedContext, t]);

  const retryRegistration = () => {
    setCredentials(null);
    setRegistrationError('');
    setAttempt((currentAttempt) => currentAttempt + 1);
  };

  if (credentials) {
    return (
      <AskRinRuntime
        credentials={credentials}
        contextPreview={contextPreview}
        onHistoryChange={onHistoryChange}
      />
    );
  }

  return (
    <div className="flex h-[min(760px,calc(100dvh-2rem))] items-center justify-center p-8">
      {registrationError ? (
        <div className="max-w-sm text-center" role="alert">
          <HiOutlineExclamationCircle className="mx-auto size-9 text-red-500" />
          <p className="mt-3 text-sm text-red-700">{registrationError}</p>
          <Button type="button" className="mt-4" onClick={retryRegistration}>
            {t('retry')}
          </Button>
        </div>
      ) : (
        <div className="text-center" role="status">
          <div className="mx-auto size-9 animate-spin rounded-full border-2 border-neutral-200 border-t-brand-trust" />
          <p className="mt-3 text-sm text-neutral-500">{t('loadingHistory')}</p>
        </div>
      )}
    </div>
  );
}

export function AskRinPanel({
  isOpen,
  onClose,
  context,
  contextPreview,
  onHistoryChange,
}: AskRinPanelProps) {
  const serializedContext = JSON.stringify(context);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="wide" className="overflow-hidden sm:max-w-2xl">
      {isOpen ? (
        <AskRinRegistration
          key={serializedContext}
          serializedContext={serializedContext}
          contextPreview={contextPreview}
          onHistoryChange={onHistoryChange}
        />
      ) : null}
    </Modal>
  );
}
