'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { HiOutlineX, HiArrowUp } from '@/components/icons';
import Image from 'next/image';
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

export default function AdaptiveLearningChatbot({
    sessionId,
    context,
    isOpen,
    onClose,
}: ChatbotProps) {
    const t = useTranslations('adaptiveLearning');
    const initialMessage = useMemo<Message>(() => ({
        id: '1',
        role: 'assistant',
        content: t('chatbot.initialGreeting')
    }), [t]);
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

    useEffect(() => () => {
        abortControllerRef.current?.abort();
    }, []);

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
        const previousHistory = messages
            .filter((msg) => msg.id !== initialMessage.id)
            .map((msg) => ({ role: msg.role, content: msg.content }));

        setMessages((prev) => [
            ...prev,
            userMsg,
            { id: assistantId, role: 'assistant', content: '' },
        ]);
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
                    chatHistory: [...previousHistory, { role: 'user', content: trimmedQuestion }],
                },
                {
                    signal: abortController.signal,
                    onContent: (_, fullContent) => {
                        setMessages((prev) => prev.map((msg) => (
                            msg.id === assistantId
                                ? { ...msg, content: fullContent }
                                : msg
                        )));
                    },
                }
            );

            setMessages((prev) => prev.map((msg) => (
                msg.id === assistantId
                    ? { ...msg, content: explanation || t('chatbot.fallbackNoResponse') }
                    : msg
            )));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t('chatbot.errorConnection');
            setMessages((prev) => prev.map((msg) => (
                msg.id === assistantId
                    ? { ...msg, content: errorMessage }
                    : msg
            )));
        } finally {
            abortControllerRef.current = null;
            setIsTyping(false);
        }
    }, [initialMessage.id, input, isTyping, messages, sessionId, t]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-full md:w-[400px] bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200 animate-slideInRight">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white shadow-sm z-10">
                <div className="flex items-center gap-2 text-slate-800">
                    <Image src={chatbotIcon} alt={t('chatbot.iconAlt')} width={20} height={20} className="w-5 h-5" />
                    <span className="font-semibold">{t('chatbot.title')}</span>
                </div>
                <button aria-label={t('common.close') || "Close chat"} onClick={onClose} className="flex min-h-[44px] min-w-[44px] items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg transition-colors hover:bg-gray-100">
                    <HiOutlineX className="w-6 h-6" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" ref={scrollRef}>
                {context && (
                    <div className="bg-white p-3 rounded-lg border border-gray-200 text-xs text-gray-500 mb-4">
                        <strong>{t('chatbot.context')}:</strong> {context}
                    </div>
                )}
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-md p-3 text-sm border ${msg.role === 'user'
                            ? 'bg-gray-900 border-gray-900 text-white rounded-br-[2px]'
                            : 'bg-white border-gray-200 text-gray-900 rounded-bl-[2px] shadow-sm'
                            }`}>
                            {msg.role === 'assistant' ? (
                                <MarkdownRenderer content={msg.content} className="whitespace-pre-wrap text-sm" />
                            ) : (
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            )}
                        </div>
                    </div>
                ))}
                {isTyping && messages[messages.length - 1]?.role !== 'assistant' && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none p-3 shadow-sm">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-gray-100">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={t('chatbot.placeholder')}
                        className="w-full pl-4 pr-14 py-3 min-h-[44px] bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors text-sm"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        aria-label={t('chatbot.send') || "Send message"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex min-h-[40px] min-w-[40px] items-center justify-center bg-gray-900 text-white rounded hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <HiArrowUp className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
