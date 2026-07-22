import { z } from 'zod';

const optionalHttpUrlSchema = z.url().nullable().optional();

export const askRinContextRequestSchema = z.discriminatedUnion('source', [
  z.strictObject({
    source: z.literal('quiz'),
    question: z.string().trim().min(1).max(12_000),
    options: z.array(z.string().trim().max(4_000)).max(20).default([]),
    questionImage: optionalHttpUrlSchema,
    optionImages: z.array(optionalHttpUrlSchema).max(20).default([]),
    conceptName: z.string().trim().max(500).nullable().optional(),
    bloomLevel: z.number().int().min(1).max(6).nullable().optional(),
  }),
  z.strictObject({
    source: z.literal('adaptive'),
    sessionId: z.string().trim().min(1).max(160),
    exerciseId: z.string().trim().min(1).max(160),
  }),
]);

export const askRinChatRequestSchema = z.strictObject({
  exerciseContextToken: z.string().min(32).max(32_768),
  message: z.string().trim().min(1).max(1_000),
  clientRequestId: z.string().min(8).max(128),
});

export const askRinConversationPathSchema = z.object({
  exerciseContextId: z.string().trim().min(1).max(160),
});

export type AskRinContextRequest = z.infer<typeof askRinContextRequestSchema>;
export type AskRinChatRequest = z.infer<typeof askRinChatRequestSchema>;
