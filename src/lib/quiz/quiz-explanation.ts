import { z } from 'zod';

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

export const QuizExplanationJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    explanation: {
      type: 'string',
      minLength: 50,
      description: 'Detailed explanation of the quiz question in Rin-chan cute tutor style. Must be educational and helpful.',
    },
    keyPoints: {
      type: 'array',
      minItems: 2,
      maxItems: 5,
      items: {
        type: 'string',
        minLength: 10,
      },
      description: '2-5 key learning points from this question as bullet points',
    },
    hint: {
      type: 'string',
      description: 'A helpful hint that guides thinking without revealing the answer directly',
    },
    encouragement: {
      type: 'string',
      description: 'A cute encouraging message from Rin-chan to motivate the student',
    },
  },
  required: ['explanation', 'keyPoints'],
} as const;

export function formatQuizExplanation(data: QuizExplanation): string {
  let result = data.explanation;

  if (data.keyPoints.length > 0) {
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
