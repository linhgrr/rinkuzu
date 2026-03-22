// src/lib/langchain.ts
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { z } from 'zod';
export {
  QuizExplanationSchema,
  QuizExplanationJsonSchema,
  formatQuizExplanation,
  type QuizExplanation,
} from '@/lib/quiz/quiz-explanation';

let keysCache: string[] | null = null;
let keyIndex = 0;

function getKeys(): string[] {
  if (!keysCache) {
    const rawKeys = process.env.GEMINI_KEYS;
    if (!rawKeys) {
      throw new Error('Please add your GEMINI_KEYS to .env.local');
    }

    keysCache = rawKeys
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    if (keysCache.length === 0) {
      throw new Error('Please add your GEMINI_KEYS to .env.local');
    }
  }

  return keysCache;
}

/**
 * Get the next API key in rotation
 */
export function getNextKey(): string {
  const keys = getKeys();
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
  return getKeys().length;
}

/**
 * Create a structured output model for non-streaming responses
 * Uses withStructuredOutput for constrained, validated output
 */
export function createStructuredModel<T extends z.ZodType>(
  schema: T,
  options?: {
    temperature?: number;
    maxRetries?: number;
    model?: string;
  }
) {
  const model = createLangChainModel(options);
  return model.withStructuredOutput(schema, {
    method: 'jsonSchema', // Use native Gemini JSON schema for better reliability
    name: 'structured_response',
  });
}

// Re-export message types and schema for convenience
export { HumanMessage, SystemMessage, AIMessage };
