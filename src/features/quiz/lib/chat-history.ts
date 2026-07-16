export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export function replaceLastAssistantMessage(
  history: ChatMessage[],
  content: string,
): ChatMessage[] {
  const nextHistory = [...history];
  for (let i = nextHistory.length - 1; i >= 0; i -= 1) {
    const message = nextHistory[i];
    if (message?.role === 'assistant') {
      nextHistory[i] = { ...message, content };
      break;
    }
  }
  return nextHistory;
}
