'use client';

import { createContext, useContext } from 'react';

export interface UpgradePromptContextValue {
  promptUpgrade: (reason?: 'rate_limit' | 'private_quiz') => void;
}

export const UpgradePromptContext = createContext<UpgradePromptContextValue | null>(null);

export function useUpgradePrompt(): UpgradePromptContextValue {
  const context = useContext(UpgradePromptContext);
  if (!context) {
    throw new Error('useUpgradePrompt must be used within UpgradePromptProvider');
  }
  return context;
}
