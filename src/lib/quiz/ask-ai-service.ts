import {
  QuizExplanationJsonSchema,
  QuizExplanationSchema,
  formatQuizExplanation,
  type QuizExplanation,
} from '@/lib/quiz/quiz-explanation';
import {
  getOpenAIChatCompletionsUrl,
  getOpenAIConfig,
} from '@/lib/langchain-openai';
import type {
  QuizAiChatMessage,
  QuizAskAiRequest,
  QuizAskAiResponseData,
} from '@/lib/quiz/ask-ai';

interface OpenAIMessagePart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenAIMessagePart[];
}

function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:|data:|vbscript:/gi, '')
    .trim()
    .substring(0, 1000);
}

export function validateQuizAskAiInput(userQuestion: string): { isValid: boolean; error?: string } {
  const sanitized = sanitizeInput(userQuestion);

  const suspiciousPatterns = [
    /ignore\s+(previous|above|all)\s+(instructions?|prompts?)/i,
    /you\s+are\s+now\s+/i,
    /forget\s+(everything|all|previous)/i,
    /act\s+as\s+(?!.*tutor)/i,
    /roleplay|role\s*play/i,
    /pretend\s+to\s+be/i,
    /system\s*:|admin\s*:|root\s*:/i,
    /<script|javascript|eval\(/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(sanitized)) {
      return {
        isValid: false,
        error: 'Rin-chan only helps with quiz questions. Please ask about the specific quiz topic!',
      };
    }
  }

  const offTopicPatterns = [
    /(hack|crack|break)\s+into/i,
    /personal\s+information/i,
    /phone\s+number|address|email/i,
  ];

  for (const pattern of offTopicPatterns) {
    if (pattern.test(sanitized)) {
      return {
        isValid: false,
        error: 'Rin-chan is here to help you understand quiz concepts. Please ask questions related to the quiz topic!',
      };
    }
  }

  return { isValid: true };
}

function getAuthHeaders() {
  const { apiKey } = getOpenAIConfig();
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

async function fetchImageBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.toString('base64');
  } catch {
    return null;
  }
}

function extractCompletionText(payload: any): string {
  const messageContent = payload?.choices?.[0]?.message?.content;

  if (typeof messageContent === 'string') {
    return messageContent.trim();
  }

  if (Array.isArray(messageContent)) {
    return messageContent
      .map(part => {
        if (typeof part === 'string') {
          return part;
        }

        if (part?.type === 'text' && typeof part.text === 'string') {
          return part.text;
        }

        return '';
      })
      .join('')
      .trim();
  }

  if (typeof payload?.content === 'string') {
    return payload.content.trim();
  }

  return '';
}

async function requestOpenAIChatCompletion(body: Record<string, unknown>): Promise<any> {
  const response = await fetch(getOpenAIChatCompletionsUrl(), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || `OpenAI-compatible request failed with status ${response.status}`);
  }

  return response.json();
}

async function summarizeChatHistory(chatHistory: QuizAiChatMessage[]): Promise<string> {
  try {
    const { model } = getOpenAIConfig();
    const chatText = chatHistory
      .slice(-6)
      .map(message => `${message.role}: ${message.content}`)
      .join('\n\n');

    const result = await requestOpenAIChatCompletion({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `
Please provide a concise summary of this educational conversation between a student and Rin-chan about a quiz question.

CONVERSATION TO SUMMARIZE:
${chatText}

Please create a brief summary (2-3 sentences) that captures:
1. The main concepts discussed
2. Key points of confusion or clarification needed
3. The current direction of the conversation

Focus only on educational content relevant to understanding the quiz question.
Keep it concise and educational.
          `.trim(),
        },
      ],
    });

    return extractCompletionText(result) || 'Previous discussion about quiz concepts and explanations.';
  } catch (error) {
    console.error('Failed to summarize chat history:', error);
    return 'Previous discussion about quiz concepts and explanations.';
  }
}

async function buildMessages(
  question: string,
  options: string[],
  userQuestion: string | undefined,
  questionImage: string | undefined,
  optionImages: (string | undefined)[] | undefined,
  contextualInfo: string
): Promise<OpenAIChatMessage[]> {
  const systemPrompt = `
Bạn là Rin-chan, một gia sư dễ thương chuyên giúp học sinh hiểu bài tập trắc nghiệm.
Ngôn ngữ mặc định: tiếng Việt (trả lời bằng ngôn ngữ của câu hỏi nếu khác).

Quy tắc:
- Chỉ thảo luận về câu hỏi quiz được cung cấp.
- Nếu hỏi lạc đề, nhẹ nhàng chuyển hướng về bài quiz.
- Giải thích dễ hiểu, khuyến khích học sinh tư duy.
- Luôn giữ vai trò gia sư giáo dục.
- Mọi biểu thức toán PHẢI dùng LaTeX: inline $...$ hoặc display $$...$$. KHÔNG viết công thức dạng text thuần.`;

  const userPrompt = `
QUIZ QUESTION:
"${question}"

OPTIONS:
${options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join('\n')}

${contextualInfo}

${userQuestion ? `STUDENT'S NEW QUESTION: "${sanitizeInput(userQuestion)}"` : 'Please provide a general explanation of this question.'}

INSTRUCTIONS:
1. Stay in character as Rin-chan - be cute but educational
2. ONLY discuss this specific quiz question and related educational concepts
3. If the conversation has history, build upon previous explanations naturally
4. Provide clear, helpful explanations that promote understanding
5. Nếu hỏi lạc đề: nhẹ nhàng chuyển về câu hỏi quiz hiện tại.
6. Answer in the same language as the question
7. Be encouraging and supportive of learning
8. Mọi công thức toán phải viết bằng LaTeX ($...$ inline hoặc $$...$$ block). Ví dụ: $x^2 + 1 = 0$, $$\\Delta = b^2 - 4ac$$

Focus on educational value and conceptual understanding!
  `.trim();

  const content: OpenAIMessagePart[] = [{ type: 'text', text: userPrompt }];

  if (questionImage) {
    const base64 = await fetchImageBase64(questionImage);

    if (base64) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${base64}` },
      });
    }
  }

  if (Array.isArray(optionImages)) {
    for (const optionImage of optionImages) {
      if (!optionImage) {
        continue;
      }

      const base64 = await fetchImageBase64(optionImage);

      if (base64) {
        content.push({
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${base64}` },
        });
      }
    }
  }

  return [
    { role: 'system', content: systemPrompt.trim() },
    { role: 'user', content },
  ];
}

function parseStructuredQuizExplanation(rawText: string): QuizExplanation {
  const parsed = JSON.parse(rawText);
  return QuizExplanationSchema.parse(parsed);
}

export async function generateQuizAskAiResponse(
  payload: QuizAskAiRequest
): Promise<QuizAskAiResponseData> {
  const { model } = getOpenAIConfig();
  const {
    question,
    options,
    userQuestion,
    questionImage,
    optionImages,
    chatHistory = [],
  } = payload;

  let contextualInfo = '';

  if (chatHistory.length > 6) {
    const summary = await summarizeChatHistory(chatHistory);
    contextualInfo = `\n\nPREVIOUS CONVERSATION SUMMARY:\n${summary}\n`;
  } else if (chatHistory.length > 0) {
    contextualInfo = `\n\nPREVIOUS CONVERSATION:\n${chatHistory
      .map(message => `${message.role}: ${message.content}`)
      .join('\n\n')}\n`;
  }

  const messages = await buildMessages(
    question,
    options,
    userQuestion,
    questionImage,
    optionImages,
    contextualInfo
  );

  const maxRetries = 2;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const structuredResult = await requestOpenAIChatCompletion({
        model,
        temperature: 0.7,
        messages,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'quiz_explanation',
            schema: QuizExplanationJsonSchema,
          },
        },
      });

      const structuredText = extractCompletionText(structuredResult);
      const parsed = parseStructuredQuizExplanation(structuredText);

      return {
        explanation: formatQuizExplanation(parsed),
        structured: parsed,
        timestamp: new Date().toISOString(),
        turnCount: Math.floor(chatHistory.length / 2) + 1,
      };
    } catch (error: any) {
      console.error(`Ask AI structured attempt ${attempt + 1} failed:`, error?.message || error);

      if (attempt === maxRetries - 1) {
        const fallbackResult = await requestOpenAIChatCompletion({
          model,
          temperature: 0.7,
          messages,
        });

        const explanation = extractCompletionText(fallbackResult);

        if (!explanation) {
          throw new Error('Ask AI fallback returned empty content');
        }

        return {
          explanation,
          structured: null,
          timestamp: new Date().toISOString(),
          turnCount: Math.floor(chatHistory.length / 2) + 1,
        };
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error('All retry attempts failed');
}

export async function streamQuizAskAiResponse(payload: QuizAskAiRequest): Promise<Response> {
  const { model } = getOpenAIConfig();
  const {
    question,
    options,
    userQuestion,
    questionImage,
    optionImages,
    chatHistory = [],
  } = payload;

  let contextualInfo = '';

  if (chatHistory.length > 6) {
    const summary = await summarizeChatHistory(chatHistory);
    contextualInfo = `\n\nPREVIOUS CONVERSATION SUMMARY:\n${summary}\n`;
  } else if (chatHistory.length > 0) {
    contextualInfo = `\n\nPREVIOUS CONVERSATION:\n${chatHistory
      .map(message => `${message.role}: ${message.content}`)
      .join('\n\n')}\n`;
  }

  const messages = await buildMessages(
    question,
    options,
    userQuestion,
    questionImage,
    optionImages,
    contextualInfo
  );

  const response = await fetch(getOpenAIChatCompletionsUrl(), {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || `Streaming request failed with status ${response.status}`);
  }

  return response;
}
