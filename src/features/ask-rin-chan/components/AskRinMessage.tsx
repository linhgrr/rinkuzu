'use client';

import {
  MessagePrimitive,
  useAuiState,
  type EmptyMessagePartProps,
  type TextMessagePartProps,
} from '@assistant-ui/react';
import { useTranslations } from 'next-intl';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { isAwaitingFirstAssistantText } from '@/lib/ask-rin-chan/stream-state';
import styles from './AskRinPanelLayout.module.css';

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

function ThinkingMessage({ status }: EmptyMessagePartProps) {
  // assistant-ui renders Empty for every empty message, finished or not (RIN-822).
  return status.type === 'running' ? <ThinkingIndicator /> : null;
}

export function AskRinMessage() {
  const role = useAuiState((state) => state.message.role);
  const isUser = role === 'user';
  const isEmptyFinishedAnswer = useAuiState(
    (state) =>
      state.message.role === 'assistant' &&
      // A stopped run leaves its message "running" though the thread has stopped.
      (state.message.status?.type !== 'running' || !state.thread.isRunning) &&
      !state.message.parts.some((part) => part.type !== 'text' || part.text.trim().length > 0),
  );

  // A failed or stopped run leaves an empty assistant message: show no bubble (RIN-822).
  if (isEmptyFinishedAnswer) return null;

  return (
    <MessagePrimitive.Root className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          isUser
            ? `${styles['userBubble']} rounded-2xl rounded-br-md bg-neutral-900 px-4 py-2.5 text-white`
            : `${styles['assistantBubble']} rounded-2xl rounded-bl-md border bg-white px-4 py-3 shadow-sm`
        }
      >
        <MessagePrimitive.Parts components={{ Text: AskRinText, Empty: ThinkingMessage }} />
      </div>
    </MessagePrimitive.Root>
  );
}
