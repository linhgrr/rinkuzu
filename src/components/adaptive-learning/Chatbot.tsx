'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { HiOutlineX, HiArrowUp } from '@/components/icons';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { streamAdaptiveTutorChat } from '@/lib/adaptive-learning/chat';

const chatbotIcon = '/images/chatbot_icon.png';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatbotProps {
  sessionId: string;
  context?: string;
  isOpen: boolean;
  onClose: () => void;
}

function isAbortLikeError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function ThinkingPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-neutral-500">
      <span className="animate-pulse font-medium">{label}</span>
      <div className="flex gap-1">
        <span
          className="h-1.5 w-1.5 rounded-full bg-neutral-400 animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-neutral-400 animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-neutral-400 animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  );
}

export default function AdaptiveLearningChatbot({
  sessionId,
  context,
  isOpen,
  onClose,
}: ChatbotProps) {
  const t = useTranslations('adaptiveLearning');
  const initialMessage = useMemo<Message>(
    () => ({
      id: '1',
      role: 'assistant',
      content: t('chatbot.initialGreeting'),
    }),
    [t],
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages([initialMessage]);
  }, [initialMessage]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!isOpen) {
      abortControllerRef.current?.abort();
    }
  }, [isOpen]);

  const handleSend = useCallback(async () => {
    const trimmedQuestion = input.trim();
    if (!trimmedQuestion || isTyping) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: trimmedQuestion };
    const assistantId = (Date.now() + 1).toString();

    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }]);
    setInput('');
    setIsTyping(true);

    try {
      if (!sessionId) {
        throw new Error(t('chatbot.errorInsufficientContext'));
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const explanation = await streamAdaptiveTutorChat(
        sessionId,
        {
          userQuestion: trimmedQuestion,
        },
        {
          signal: abortController.signal,
          onContent: (_, fullContent) => {
            setMessages((prev) =>
              prev.map((msg) => (msg.id === assistantId ? { ...msg, content: fullContent } : msg)),
            );
          },
        },
      );

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: explanation || t('chatbot.fallbackNoResponse') }
            : msg,
        ),
      );
    } catch (error) {
      if (isAbortLikeError(error)) {
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== assistantId || msg.content.trim().length > 0),
        );
        return;
      }

      const errorMessage = error instanceof Error ? error.message : t('chatbot.errorConnection');
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: msg.content.trim()
                  ? `${msg.content}\n\n${t('chatbot.errorInterrupted')}`
                  : errorMessage,
              }
            : msg,
        ),
      );
    } finally {
      abortControllerRef.current = null;
      setIsTyping(false);
    }
  }, [input, isTyping, sessionId, t]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[400px] bg-white shadow-2xl z-50 flex flex-col border-l border-neutral-200 animate-slideInRight">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-white shadow-sm z-10">
        <div className="flex items-center gap-2 text-neutral-800">
          <Image
            src={chatbotIcon}
            alt={t('chatbot.iconAlt')}
            width={20}
            height={20}
            className="w-5 h-5"
          />
          <span className="font-semibold">{t('chatbot.title')}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('common.close') || 'Close chat'}
          onClick={onClose}
          className="text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
        >
          <HiOutlineX className="w-6 h-6" />
        </Button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-50"
        ref={scrollRef}
        role="log"
        aria-live="polite"
      >
        {context && (
          <div className="bg-white p-3 rounded-lg border border-neutral-200 text-xs text-neutral-500 mb-4">
            <strong>{t('chatbot.context')}:</strong> {context}
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-md p-3 text-sm border ${
                msg.role === 'user'
                  ? 'bg-neutral-900 border-neutral-900 text-white rounded-br-[2px]'
                  : 'bg-white border-neutral-200 text-neutral-900 rounded-bl-[2px] shadow-sm'
              }`}
            >
              {msg.role === 'assistant' && isTyping && !msg.content.trim() ? (
                <ThinkingPlaceholder label={t('chatbot.thinking')} />
              ) : msg.role === 'assistant' ? (
                <MarkdownRenderer content={msg.content} className="whitespace-pre-wrap text-sm" />
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-neutral-100">
        <div className="relative">
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t('chatbot.placeholder')}
            className="min-h-[44px] border-neutral-200 bg-white py-3 pl-4 pr-14 text-sm focus-visible:ring-neutral-900"
          />
          <Button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            aria-label={t('chatbot.send') || 'Send message'}
            className="absolute right-2 top-1/2 min-h-[40px] min-w-[40px] -translate-y-1/2 rounded bg-neutral-900 p-0 text-white hover:bg-black"
          >
            <HiArrowUp className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
