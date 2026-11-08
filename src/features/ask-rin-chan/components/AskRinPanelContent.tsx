'use client';

import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ExportedMessageRepository,
  ThreadPrimitive,
  useAui,
  useAuiEvent,
  useAuiState,
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
import { Modal } from '@/components/ui/Modal';
import {
  deleteAskRinConversation,
  getAskRinConversation,
  registerAskRinContext,
  type AskRinContextCredentials,
  type AskRinContextPayload,
} from '@/lib/ask-rin-chan/client';
import { fetchAskRinAgent } from '@/lib/ask-rin-chan/agui-fetch';
import { useAskRinErrorMessage } from '@/features/ask-rin-chan/hooks/use-ask-rin-error-message';
import { AskRinEmptyConversation } from './AskRinEmptyConversation';
import { AskRinMessage } from './AskRinMessage';
import styles from './AskRinPanelLayout.module.css';

const CHATBOT_ICON = '/images/chatbot_icon.png';

interface AskRinHistorySummary {
  totalMessages: number;
  totalTurns: number;
}

export interface AskRinPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context: AskRinContextPayload;
  contextPreview?: ReactNode;
  onHistoryChange?: (summary: AskRinHistorySummary) => void;
}

interface AskRinFailure {
  message: string;
  retryable: boolean;
}

const NO_FAILURE: AskRinFailure = { message: '', retryable: false };

function findLastUserMessageId(messages: readonly { id: string; role: string }[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user') return message.id;
  }
  return null;
}

interface AskRinRuntimeProps {
  credentials: AskRinContextCredentials;
  contextPreview?: ReactNode;
  onHistoryChange?: (summary: AskRinHistorySummary) => void;
}

function AskRinThread({
  credentials,
  contextPreview,
  error,
  historySettled,
  runFailed,
  onError,
  onHistoryReset,
}: Omit<AskRinRuntimeProps, 'onHistoryChange'> & {
  error: string;
  historySettled: boolean;
  runFailed: boolean;
  onError: (message: string) => void;
  onHistoryReset: () => void;
}) {
  const t = useTranslations('adaptiveLearning.chatbot');
  const tCommon = useTranslations('common');
  const aui = useAui();
  const messages = useAuiState((state) => state.thread.messages);
  const isRunning = useAuiState((state) => state.thread.isRunning);
  // The runtime starts the history load in an effect, so its first commit reports
  // isLoading false: without historySettled the empty state flashes first (RIN-1207).
  const isLoading = useAuiState((state) => state.thread.isLoading) || !historySettled;
  const [clearing, setClearing] = useState(false);
  const failedQuestionId = runFailed && !isRunning ? findLastUserMessageId(messages) : null;

  // Retry reruns from the learner's own message, so the same text is sent once more (RIN-1019).
  const retryFailedQuestion = () => {
    if (!failedQuestionId) return;
    aui.thread().startRun({ parentId: failedQuestionId });
  };

  // Asking again replaces the previous run's error card with the thinking bubble (RIN-822).
  useAuiEvent('thread.runStart', () => onError(''));

  useEffect(() => {
    return () => {
      if (aui.thread().getState().isRunning) aui.thread().cancelRun();
    };
  }, [aui]);

  const clearConversation = async () => {
    if (clearing || isRunning) return;
    setClearing(true);
    onError('');
    try {
      await deleteAskRinConversation(credentials.exerciseContextId);
      aui.thread().reset();
      onHistoryReset();
    } catch {
      // Context copy rather than the server text (RIN-756).
      onError(t('errorClear'));
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className={`${styles['panelHeight']} flex min-h-0 flex-col`}>
      <header className={`${styles['borderSubtle']} border-b px-5 py-4 pr-16 sm:px-6 sm:pr-16`}>
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
        <details
          className={`${styles['borderSubtle']} group border-b bg-neutral-50/80 px-5 py-3 sm:px-6`}
        >
          <summary
            className={`${styles['contextLabel']} cursor-pointer select-none text-xs font-semibold uppercase text-neutral-500 marker:text-neutral-400`}
          >
            {t('contextQuestion')}
          </summary>
          <div
            className={`${styles['borderMuted']} mt-3 max-h-40 overflow-y-auto rounded-xl border bg-white p-3 text-sm text-neutral-700`}
          >
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
                <AskRinEmptyConversation />
              </ThreadPrimitive.Empty>
              <div className="space-y-4">
                <ThreadPrimitive.Messages components={{ Message: AskRinMessage }} />
                {failedQuestionId ? (
                  <div className="-mt-2 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={retryFailedQuestion}
                      className="text-neutral-600"
                    >
                      {t('retryMessage')}
                    </Button>
                  </div>
                ) : null}
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

        <div className={`${styles['borderSubtle']} border-t bg-white p-4 sm:px-6`}>
          <ComposerPrimitive.Root
            className={`${styles['borderMuted']} flex items-end gap-2 rounded-2xl border bg-white p-2 shadow-sm transition focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-100`}
          >
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
          <p className={`${styles['composerHint']} mt-2 text-center text-neutral-400`}>
            {t('composerHint')}
          </p>
        </div>
      </ThreadPrimitive.Root>
    </div>
  );
}

function AskRinRuntime({ credentials, contextPreview, onHistoryChange }: AskRinRuntimeProps) {
  const t = useTranslations('adaptiveLearning.chatbot');
  const historyErrorLabel = t('errorHistory');
  const interruptedLabel = t('errorInterrupted');
  const askRinErrorMessage = useAskRinErrorMessage();
  // Only a failed send offers Retry; history or clear errors do not (RIN-1019).
  const [failure, setFailure] = useState<AskRinFailure>(NO_FAILURE);
  const [historySettled, setHistorySettled] = useState(false);
  const showError = (message: string) => setFailure({ message, retryable: false });
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

  // The API reports a failed run as an in-stream RUN_ERROR, which the AG-UI runtime
  // ends as an empty answer without calling onError (RIN-822).
  useEffect(() => {
    const subscription = agent.subscribe({
      onRunErrorEvent: ({ event }) => {
        // The client turns a learner's Stop into RUN_ERROR code "abort": no error card.
        if (event.code !== 'abort') {
          setFailure({ message: askRinErrorMessage(event), retryable: true });
        }
      },
    });
    return () => subscription.unsubscribe();
  }, [agent, askRinErrorMessage]);

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
          setFailure(NO_FAILURE);
          setHistorySettled(true);
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
        } catch {
          // Context copy ("you can still ask") rather than the server text (RIN-756).
          setFailure({ message: historyErrorLabel, retryable: false });
          setHistorySettled(true);
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
      setFailure({ message: askRinErrorMessage(runError), retryable: true });
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
        error={failure.message}
        historySettled={historySettled}
        runFailed={failure.retryable}
        onError={showError}
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
  const askRinErrorMessage = useAskRinErrorMessage();
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
          setRegistrationError(askRinErrorMessage(contextError));
        }
      });
    return () => {
      active = false;
    };
  }, [attempt, serializedContext, askRinErrorMessage]);

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
    <div className={`${styles['panelHeight']} flex items-center justify-center p-8`}>
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
          <div
            className={`${styles['loadingSpinner']} mx-auto size-9 animate-spin rounded-full border-2`}
          />
          <p className="mt-3 text-sm text-neutral-500">{t('loadingHistory')}</p>
        </div>
      )}
    </div>
  );
}

export function AskRinPanelContent({
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
