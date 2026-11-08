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

const agUiTextPartSchema = z.strictObject({
  type: z.literal('text'),
  text: z.string().max(12_000),
});

const agUiMessageSchema = z.looseObject({
  id: z.string().min(1).max(200),
  role: z.enum(['developer', 'system', 'assistant', 'user', 'tool', 'activity', 'reasoning']),
  content: z.union([z.string().max(12_000), z.array(agUiTextPartSchema).max(20)]).optional(),
});

const agUiResumeSchema = z.strictObject({
  interruptId: z.string().min(1).max(200),
  status: z.enum(['resolved', 'cancelled']),
  payload: z.unknown().optional(),
});

export const askRinAgentRequestSchema = z
  .strictObject({
    threadId: z.string().trim().min(1).max(400),
    runId: z.string().min(1).max(128),
    parentRunId: z.string().max(128).optional(),
    // @ag-ui/client 1.x declares the protocol it speaks on every run (RIN-1195).
    protocolVersion: z.string().max(32).optional(),
    // @ag-ui/client 1.x drops `state: null` from the body it sends; the adaptive API still
    // expects the key, so restore the null the 0.0.x client sent (RIN-1202).
    state: z.unknown().default(null),
    messages: z.array(agUiMessageSchema).min(1).max(100),
    tools: z.array(z.never()).max(0),
    context: z.array(z.never()).max(0),
    forwardedProps: z.strictObject({
      exerciseContextToken: z.string().min(32).max(32_768),
    }),
    resume: z.array(agUiResumeSchema).max(100).optional(),
  })
  .superRefine((value, context) => {
    if (JSON.stringify(value).length <= 262_144) return;
    context.addIssue({
      code: 'custom',
      message: 'AG-UI request exceeds the 256 KiB limit',
      path: [],
    });
  });

export const askRinConversationPathSchema = z.object({
  exerciseContextId: z.string().trim().min(1).max(160),
});

export type AskRinContextRequest = z.infer<typeof askRinContextRequestSchema>;
