'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { DynamicMarkdownRenderer as MarkdownRenderer } from '@/components/ui/DynamicMarkdownRenderer';
import { ChatMessage } from '@/features/quiz/hooks/useStreamingChatSession';

interface StreamingChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  questionContent: ReactNode;
  messages: ChatMessage[];
  userLabel: string;
  assistantLabel: string;
  userQuestion: string;
  onUserQuestionChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSend: () => void;
  sendDisabled: boolean;
  sendLabel: string;
  loadingLabel: string;
  loadingAI: boolean;
  aiError?: string;
  inputPlaceholder: string;
  inputMode?: 'input' | 'textarea';
  inputHintLeft?: string;
  inputHintRight?: string;
  clearLabel?: string;
  onClearHistory?: () => void;
  showTimestamps?: boolean;
}

export function StreamingChatModal({
  isOpen,
  onClose,
  title,
  questionContent,
  messages,
  userLabel,
  assistantLabel,
  userQuestion,
  onUserQuestionChange,
  onKeyDown,
  onSend,
  sendDisabled,
  sendLabel,
  loadingLabel,
  loadingAI,
  aiError,
  inputPlaceholder,
  inputMode = 'textarea',
  inputHintLeft,
  inputHintRight,
  clearLabel,
  onClearHistory,
  showTimestamps = false,
}: StreamingChatModalProps) {
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || !chatContainerRef.current) return;
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [messages, loadingAI, isOpen]);

  const isTextarea = inputMode === 'textarea';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="wide">
      <div className="space-y-4">
        <div className="border rounded-lg p-4 bg-neutral-50">{questionContent}</div>

        <div
          ref={chatContainerRef}
          className="border rounded-lg p-4 bg-white max-h-[60vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-neutral-900">Chat History</h4>
            {onClearHistory && clearLabel && messages.length > 0 && (
              <Button
                onClick={onClearHistory}
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                {clearLabel}
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={`${message.role}-${message.timestamp}-${message.content.slice(0, 24)}`}
                className={`p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-orange-50 border-l-4 border-orange-300'
                    : 'bg-green-50 border-l-4 border-green-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-neutral-700">
                    {message.role === 'user' ? userLabel : assistantLabel}
                  </span>
                  {showTimestamps && (
                    <span className="text-xs text-neutral-500" suppressHydrationWarning>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>
                <div className="text-sm text-neutral-800">
                  {message.role === 'assistant' ? (
                    <MarkdownRenderer content={message.content} />
                  ) : (
                    <p>{message.content}</p>
                  )}
                </div>
              </div>
            ))}

            {loadingAI && (
              <div className="p-3 rounded-lg bg-green-50 border-l-4 border-green-400">
                <div className="text-sm text-neutral-700">{loadingLabel}...</div>
              </div>
            )}
          </div>
        </div>

        <div>
          {isTextarea ? (
            <textarea
              value={userQuestion}
              onChange={(event) => onUserQuestionChange(event.target.value)}
              onKeyDown={onKeyDown}
              className="w-full p-3 border border-neutral-300 rounded-lg resize-none focus:ring-2 focus:ring-brand-trust focus:border-transparent"
              rows={3}
              placeholder={inputPlaceholder}
              disabled={loadingAI}
            />
          ) : (
            <input
              className="w-full border border-neutral-300 rounded px-3 py-2 focus:ring-2 focus:ring-brand-trust focus:border-transparent"
              value={userQuestion}
              onChange={(event) => onUserQuestionChange(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={inputPlaceholder}
              disabled={loadingAI}
            />
          )}
          {(inputHintLeft || inputHintRight) && (
            <div className="flex justify-between text-xs text-neutral-500 mt-1">
              <span>{inputHintLeft || ''}</span>
              <span>{inputHintRight || ''}</span>
            </div>
          )}
        </div>

        <Button onClick={onSend} disabled={sendDisabled} className="w-full">
          {loadingAI ? loadingLabel : sendLabel}
        </Button>

        {aiError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {aiError}
          </div>
        )}
      </div>
    </Modal>
  );
}
