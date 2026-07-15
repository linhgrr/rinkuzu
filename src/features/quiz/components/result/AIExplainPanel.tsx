'use client';

import { StreamingChatModal } from '@/features/quiz/components/chat/StreamingChatModal';
import { QuestionOptionsPreview } from '@/features/quiz/components/shared/QuestionOptionsPreview';
import type { ChatMessage } from '@/features/quiz/hooks/useStreamingChatSession';

interface AIExplainPanelProps {
  isOpen: boolean;
  onClose: () => void;
  questionContent: {
    questionText: string;
    options: string[];
    questionImage?: string;
    optionImages?: (string | undefined)[];
  } | null;
  messages: ChatMessage[];
  userLabel: string;
  assistantLabel: string;
  userQuestion: string;
  onUserQuestionChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  sendDisabled: boolean;
  sendLabel: string;
  loadingLabel: string;
  loadingAI: boolean;
  aiError: string;
  inputPlaceholder: string;
  inputMode: 'textarea' | 'input';
  inputHintLeft: string;
  inputHintRight: string;
  clearLabel: string;
  onClearHistory: () => void;
  showTimestamps: boolean;
  title: string;
}

export function AIExplainPanel({
  isOpen,
  onClose,
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
  inputMode,
  inputHintLeft,
  inputHintRight,
  clearLabel,
  onClearHistory,
  showTimestamps,
  title,
}: AIExplainPanelProps) {
  if (!isOpen || !questionContent) return null;

  return (
    <StreamingChatModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      questionContent={
        <QuestionOptionsPreview
          questionText={questionContent.questionText}
          options={questionContent.options}
          {...(questionContent.questionImage !== undefined
            ? { questionImage: questionContent.questionImage }
            : {})}
          {...(questionContent.optionImages !== undefined
            ? { optionImages: questionContent.optionImages }
            : {})}
        />
      }
      messages={messages}
      userLabel={userLabel}
      assistantLabel={assistantLabel}
      userQuestion={userQuestion}
      onUserQuestionChange={onUserQuestionChange}
      onKeyDown={onKeyDown}
      onSend={onSend}
      sendDisabled={sendDisabled}
      sendLabel={sendLabel}
      loadingLabel={loadingLabel}
      loadingAI={loadingAI}
      aiError={aiError}
      inputPlaceholder={inputPlaceholder}
      inputMode={inputMode}
      inputHintLeft={inputHintLeft}
      inputHintRight={inputHintRight}
      clearLabel={clearLabel}
      onClearHistory={onClearHistory}
      showTimestamps={showTimestamps}
    />
  );
}
