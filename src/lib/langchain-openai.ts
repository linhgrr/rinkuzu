// src/lib/langchain-openai.ts
// OpenAI-compatible API support for Ask AI feature
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { z } from 'zod';
export {
  QuizExplanationSchema,
  QuizExplanationJsonSchema,
  formatQuizExplanation,
  type QuizExplanation,
} from '@/lib/quiz/quiz-explanation';

// Validate environment variables
export function getOpenAIConfig() {
  const baseURL = process.env.OPENAI_API_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  if (!baseURL) {
    throw new Error('Please add OPENAI_API_BASE_URL to .env.local');
  }

  if (!apiKey) {
    throw new Error('Please add OPENAI_API_KEY to .env.local');
  }

  return { baseURL, apiKey, model };
}

export function getOpenAIChatCompletionsUrl(): string {
  const { baseURL } = getOpenAIConfig();
  const normalizedBaseURL = baseURL.replace(/\/+$/, '');

  if (normalizedBaseURL.endsWith('/chat/completions')) {
    return normalizedBaseURL;
  }

  if (normalizedBaseURL.endsWith('/v1')) {
    return `${normalizedBaseURL}/chat/completions`;
  }

  return `${normalizedBaseURL}/v1/chat/completions`;
}

/**
 * Create a new ChatOpenAI instance with custom endpoint
 */
export function createOpenAIModel(options?: {
  temperature?: number;
  maxRetries?: number;
  model?: string;
}): ChatOpenAI {
  const config = getOpenAIConfig();

  return new ChatOpenAI({
    apiKey: config.apiKey,
    model: options?.model ?? config.model,
    temperature: options?.temperature ?? 0.7,
    maxRetries: options?.maxRetries ?? 2,
    configuration: {
      baseURL: config.baseURL,
    },
  });
}

/**
 * Create a structured output model for non-streaming responses
 * Uses withStructuredOutput for constrained, validated output
 */
export function createStructuredOpenAIModel<T extends z.ZodType>(
  schema: T,
  options?: {
    temperature?: number;
    maxRetries?: number;
    model?: string;
  }
) {
  const model = createOpenAIModel(options);
  return model.withStructuredOutput(schema, {
    method: 'json_schema',
    name: 'structured_response',
  });
}

// Re-export message types and schema for convenience
export { HumanMessage, SystemMessage, AIMessage };
