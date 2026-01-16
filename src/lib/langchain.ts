// src/lib/langchain.ts
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';

if (!process.env.GEMINI_KEYS) {
  throw new Error('Please add your GEMINI_KEYS to .env.local');
}

const keys = process.env.GEMINI_KEYS!.split(',').map(k => k.trim());
let keyIndex = 0;

/**
 * Get the next API key in rotation
 */
export function getNextKey(): string {
  const key = keys[keyIndex];
  keyIndex = (keyIndex + 1) % keys.length;
  return key;
}

/**
 * Create a new ChatGoogleGenerativeAI instance with key rotation
 */
export function createLangChainModel(options?: {
  temperature?: number;
  maxRetries?: number;
  model?: string;
}): ChatGoogleGenerativeAI {
  const apiKey = getNextKey();

  return new ChatGoogleGenerativeAI({
    apiKey,
    model: options?.model ?? 'gemini-2.5-flash',
    temperature: options?.temperature ?? 0,
    maxRetries: options?.maxRetries ?? 2,
  });
}

/**
 * Get total number of available keys
 */
export function getKeysCount(): number {
  return keys.length;
}

// Re-export message types for convenience
export { HumanMessage, SystemMessage, AIMessage };
