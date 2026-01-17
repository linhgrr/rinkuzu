// src/lib/langchain.ts
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { z } from 'zod';

// ==========================================
// CONSTRAINED OUTPUT SCHEMAS (Best Practice 2025)
// ==========================================

/**
 * Schema for quiz explanation output from Rin-chan tutor
 * Used for non-streaming responses to ensure structured, validated output
 */
export const QuizExplanationSchema = z.object({
  explanation: z
    .string()
    .min(50)
    .describe('Detailed explanation of the quiz question in Rin-chan cute tutor style. Must be educational and helpful.'),
  keyPoints: z
    .array(z.string().min(10))
    .min(2)
    .max(5)
    .describe('2-5 key learning points from this question as bullet points'),
  hint: z
    .string()
    .optional()
    .describe('A helpful hint that guides thinking without revealing the answer directly'),
  encouragement: z
    .string()
    .optional()
    .describe('A cute encouraging message from Rin-chan to motivate the student'),
});

export type QuizExplanation = z.infer<typeof QuizExplanationSchema>;

/**
 * Format structured output to readable text for display
 */
export function formatQuizExplanation(data: QuizExplanation): string {
  let result = data.explanation;

  if (data.keyPoints && data.keyPoints.length > 0) {
    result += '\n\n📚 **Điểm chính:**\n';
    result += data.keyPoints.map(point => `• ${point}`).join('\n');
  }

  if (data.hint) {
    result += `\n\n💡 **Gợi ý:** ${data.hint}`;
  }

  if (data.encouragement) {
    result += `\n\n${data.encouragement}`;
  }

  return result;
}

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
