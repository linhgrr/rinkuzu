import { describe, expect, it } from 'vitest';
import {
  adaptiveHistoryDeletePathParamsSchema,
  adaptiveHistoryDeleteQuerySchema,
  adaptiveHistoryGetPathParamsSchema,
  adaptiveHistoryProgressQuerySchema,
} from '@/dtos/adaptive-history';
import {
  adaptiveSessionGetPathParamsSchema,
  adaptiveSessionPostPathParamsSchema,
  adaptiveSubmitAnswerRequestSchema,
  adaptiveTutorChatRequestSchema,
} from '@/dtos/adaptive-session';
import { adaptivePipelineSessionCreateQuerySchema } from '@/dtos/adaptive-pipeline';

describe('adaptive Next API contracts', () => {
  it('allows only known session routes', () => {
    expect(
      adaptiveSessionGetPathParamsSchema.parse({ path: ['session-1', 'concept', 'concept-1'] }),
    ).toEqual({
      sessionId: 'session-1',
      action: 'concept',
      conceptId: 'concept-1',
    });
    expect(adaptiveSessionPostPathParamsSchema.parse({ path: ['session-1', 'submit'] })).toEqual({
      sessionId: 'session-1',
      action: 'submit',
    });
    expect(
      adaptiveSessionPostPathParamsSchema.safeParse({ path: ['session-1', 'unknown'] }).success,
    ).toBe(false);
  });

  it('validates session request bodies against FastAPI request shapes', () => {
    expect(
      adaptiveSubmitAnswerRequestSchema.parse({
        exercise_id: 'exercise-1',
        idempotency_key: 'submit-1',
        answer: { choices: ['A', 'B'] },
      }),
    ).toEqual({
      exercise_id: 'exercise-1',
      idempotency_key: 'submit-1',
      answer: { choices: ['A', 'B'] },
    });
    expect(
      adaptiveTutorChatRequestSchema.safeParse({
        userQuestion: '',
        stream: true,
      }).success,
    ).toBe(false);
  });

  it('allows only supported history routes and typed queries', () => {
    expect(adaptiveHistoryGetPathParamsSchema.parse({ path: ['subjects', 'progress'] })).toEqual({
      kind: 'progress',
    });
    expect(adaptiveHistoryDeletePathParamsSchema.parse({ path: ['subjects', 'job-1'] })).toEqual({
      jobId: 'job-1',
    });
    expect(adaptiveHistoryProgressQuerySchema.parse({ limit: '500' })).toEqual({ limit: 500 });
    expect(adaptiveHistoryDeleteQuerySchema.parse({ delete_sessions: 'false' })).toEqual({
      delete_sessions: false,
    });
    expect(adaptiveHistoryGetPathParamsSchema.safeParse({ path: ['pipeline-jobs'] }).success).toBe(
      false,
    );
  });

  it('bounds pipeline session creation consistently with FastAPI', () => {
    expect(adaptivePipelineSessionCreateQuerySchema.parse({ max_steps: '50' })).toEqual({
      max_steps: 50,
    });
    expect(adaptivePipelineSessionCreateQuerySchema.safeParse({ max_steps: '10001' }).success).toBe(
      false,
    );
  });
});
