'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { HiArrowUp, HiOutlineTrash, HiOutlineX } from 'react-icons/hi';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { useAskRinChanSession } from '@/features/quiz/hooks/useAskRinChanSession';

const chatbotIcon = '/images/chatbot_icon.png';

interface ChatbotProps {
  sessionId: string;
  exerciseId: string;
  context?: string;
  isOpen: boolean;
  onClose: () => void;
}

function ThinkingPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-neutral-500">
      <span className="animate-pulse font-medium">{label}</span>
      <div className="flex gap-1" aria-hidden="true">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-pulse rounded-full bg-neutral-400"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AdaptiveLearningChatbot({
  sessionId,
  exerciseId,
  context,
  isOpen,
  onClose,
}: ChatbotProps) {
  const t = useTranslations('adaptiveLearning');
  const {
    aiError,
    cancelActiveStream,
    clearHistory,
    ensureHistory,
    getHistory,
    loadingAI,
    sendMessage,
    setUserQuestion,
    userQuestion,
  } = useAskRinChanSession();
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = getHistory(exerciseId);
  const contextPayload = { source: 'adaptive' as const, sessionId, exerciseId };
  const onOpen = useEffectEvent(() => ensureHistory(exerciseId, contextPayload));
  const onCloseStream = useEffectEvent(cancelActiveStream);

  useEffect(() => {
    if (isOpen) onOpen();
  }, [exerciseId, isOpen, sessionId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen, loadingAI]);

  useEffect(() => {
    if (!isOpen) onCloseStream();
  }, [isOpen]);

  const handleSend = async () => {
    await sendMessage({
      historyKey: exerciseId,
      payload: contextPayload,
      emptyQuestionErrorMessage: t('chatbot.placeholder'),
      requestErrorMessage: t('chatbot.errorConnection'),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-neutral-200 bg-white shadow-2xl animate-slideInRight md:w-[400px]">
      <div className="z-10 flex items-center justify-between border-b border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-neutral-800">
          <Image src={chatbotIcon} alt={t('chatbot.iconAlt')} width={20} height={20} />
          <span className="font-semibold">{t('chatbot.title')}</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t('chatbot.clearHistory')}
              title={t('chatbot.clearHistory')}
              onClick={() => void clearHistory(exerciseId)}
              className="text-neutral-400 hover:bg-red-50 hover:text-red-600"
            >
              <HiOutlineTrash className="size-5" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('common.close') || 'Close chat'}
            onClick={onClose}
            className="text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <HiOutlineX className="size-6" />
          </Button>
        </div>
      </div>

      <div
        className="flex-1 space-y-4 overflow-y-auto bg-neutral-50 p-4"
        ref={scrollRef}
        role="log"
        aria-live="polite"
      >
        {context ? (
          <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-3 text-xs text-neutral-500">
            <strong>{t('chatbot.context')}:</strong> {context}
          </div>
        ) : null}
        {messages.length === 0 ? (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-md rounded-bl-[2px] border border-neutral-200 bg-white p-3 text-sm text-neutral-900 shadow-sm">
              {t('chatbot.initialGreeting')}
            </div>
          </div>
        ) : null}
        {messages.map((message) => (
          <div
            key={message.id ?? `${message.role}-${message.timestamp}`}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-md border p-3 text-sm ${
                message.role === 'user'
                  ? 'rounded-br-[2px] border-neutral-900 bg-neutral-900 text-white'
                  : 'rounded-bl-[2px] border-neutral-200 bg-white text-neutral-900 shadow-sm'
              }`}
            >
              {message.role === 'assistant' && loadingAI && !message.content.trim() ? (
                <ThinkingPlaceholder label={t('chatbot.thinking')} />
              ) : message.role === 'assistant' ? (
                <MarkdownRenderer
                  content={message.content}
                  className="whitespace-pre-wrap text-sm"
                />
              ) : (
                <div className="whitespace-pre-wrap">{message.content}</div>
              )}
            </div>
          </div>
        ))}
        {aiError ? (
          <div
            role="alert"
            className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {aiError}
          </div>
        ) : null}
      </div>

      <div className="border-t border-neutral-100 bg-white p-4">
        <div className="relative">
          <Input
            type="text"
            value={userQuestion}
            onChange={(event) => setUserQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) void handleSend();
            }}
            placeholder={t('chatbot.placeholder')}
            className="min-h-[44px] border-neutral-200 bg-white py-3 pl-4 pr-14 text-sm focus-visible:ring-neutral-900"
            disabled={loadingAI}
          />
          <Button
            type="button"
            onClick={() => void handleSend()}
            disabled={!userQuestion.trim() || loadingAI}
            aria-label={t('chatbot.send') || 'Send message'}
            className="absolute right-2 top-1/2 min-h-[40px] min-w-[40px] -translate-y-1/2 rounded bg-neutral-900 p-0 text-white hover:bg-neutral-800"
          >
            <HiArrowUp className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
