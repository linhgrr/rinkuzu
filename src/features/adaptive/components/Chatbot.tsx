'use client';

import { AskRinPanel } from '@/features/ask-rin-chan/components/AskRinPanel';

interface ChatbotProps {
  sessionId: string;
  exerciseId: string;
  context?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AdaptiveLearningChatbot({
  sessionId,
  exerciseId,
  context,
  isOpen,
  onClose,
}: ChatbotProps) {
  return (
    <AskRinPanel
      isOpen={isOpen}
      onClose={onClose}
      context={{ source: 'adaptive', sessionId, exerciseId }}
      contextPreview={context ? <p className="whitespace-pre-wrap">{context}</p> : undefined}
    />
  );
}
