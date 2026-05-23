// /src/app/api/draft/[id]/process-chunk/route.ts
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import connectDB from '@/lib/mongoose';
import DraftQuiz from '@/models/DraftQuiz';
import { extractQuizFromS3Key } from '@/lib/quiz/extractApi';
import { randomUUID } from 'crypto';
import { buildLlmRateLimitResponse, checkLlmRateLimit, isAdminRole } from '@/lib/llm/rate-limit';

import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';

interface ChunkDetail {
  index: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  lockedAt?: Date | null;
  lockedBy?: string | null;
  error?: string | null;
}

interface DraftQuestion {
  question: string;
  options: string[];
  type?: 'single' | 'multiple';
  correctIndex?: number;
  correctIndexes?: number[];
}

export const POST = withAuth<{ id: string }>(
  async (request: NextRequest, { params, userId, session }) => {
    try {
      const { id } = params;
      const userRole = session.user.role;

      let chunkIndex: number;
      try {
        const body = await request.json();
        chunkIndex = body.chunkIndex;
      } catch (_parseError) {
        return apiErr('validation_error', 'Invalid or empty request body', 400);
      }

      if (typeof chunkIndex !== 'number' || chunkIndex < 0) {
        return apiErr('validation_error', 'Valid chunkIndex is required', 400);
      }

      if (!isAdminRole(userRole)) {
        const rateLimit = await checkLlmRateLimit(userId, 'quiz_extract');
        if (!rateLimit.allowed) {
          return buildLlmRateLimitResponse(rateLimit);
        }
      }

      const LOCK_TIMEOUT_MS = 600000; // 10 minutes - extraction may take multiple minutes

      // Generate unique request ID
      const requestId = randomUUID();
      const now = new Date();
      const lockExpiry = new Date(now.getTime() - LOCK_TIMEOUT_MS);

      await connectDB();

      // Atomic lock acquisition - only lock if:
      // 1. status is 'pending' or 'error', OR
      // 2. status is 'processing' but lock is stale (older than LOCK_TIMEOUT_MS)
      const lockResult = await DraftQuiz.findOneAndUpdate(
        {
          _id: id,
          userId,
          'chunks.chunkDetails': {
            $elemMatch: {
              index: chunkIndex,
              $or: [
                { status: { $in: ['pending', 'error'] } },
                { status: 'processing', lockedAt: { $lt: lockExpiry } },
              ],
            },
          },
        },
        {
          $set: {
            'chunks.chunkDetails.$.status': 'processing',
            'chunks.chunkDetails.$.lockedAt': now,
            'chunks.chunkDetails.$.lockedBy': requestId,
            'chunks.current': chunkIndex,
          },
        },
        { new: true },
      );

      if (!lockResult) {
        // Could not acquire lock - check why
        const draft = await DraftQuiz.findOne({
          _id: id,
          userId,
        });

        if (!draft) {
          return apiErr('not_found', 'Draft not found', 404);
        }

        const chunk = draft.chunks.chunkDetails.find((c: ChunkDetail) => c.index === chunkIndex);

        if (chunk?.status === 'done') {
          return apiOk(
            {
              questions: [],
              progress: {
                processed: draft.chunks.processed,
                total: draft.chunks.total,
                isComplete: draft.chunks.processed >= draft.chunks.total,
              },
            },
            200,
            { meta: { message: 'Chunk already processed' } },
          );
        }

        // Another request is processing it
        return apiErr('conflict', 'Chunk is being processed by another request', 409, {
          retryAfter: 5000,
        });
      }

      // We have the lock, use lockResult as draft
      const draft = lockResult;

      // 2. Initial check - is the client already gone?
      if (request.signal.aborted) {
        return apiErr('request_aborted', 'Request aborted', 499);
      }

      if (!draft.pdfData.pdfKey) {
        return apiErr('validation_error', 'PDF not available', 400);
      }

      const chunkDetail = draft.chunks.chunkDetails.find(
        (c: ChunkDetail) => c.index === chunkIndex,
      );

      if (!chunkDetail) {
        return apiErr('not_found', 'Chunk not found', 404);
      }

      try {
        // Pre-AI check - is the client still there?
        if (request.signal.aborted) {
          throw new Error('AbortError: Request was cancelled by user');
        }

        // Pre-AI check - double check if draft was deleted while waiting for lock.
        const stillExists = await DraftQuiz.exists({ _id: id });
        if (!stillExists) {
          throw new Error('Draft was deleted or cancelled');
        }

        const { questions: extractedQuestions } = await extractQuizFromS3Key({
          s3Key: draft.pdfData.pdfKey,
          userId,
          userPrompt: draft.prompt,
          timeoutMs: 280000,
        });

        // Remove duplicates with existing questions
        const existingHashes = new Set(draft.questions.map((q: DraftQuestion) => hashQuestion(q)));

        const newQuestions = extractedQuestions.filter((newQ: DraftQuestion) => {
          const hash = hashQuestion(newQ);

          // Check exact hash match
          if (existingHashes.has(hash)) {
            console.warn('Duplicate (exact hash):', newQ.question?.substring(0, 50));
            return false;
          }

          // Check fuzzy similarity with existing questions
          for (const existingQ of draft.questions) {
            if (areSimilarQuestions(newQ, existingQ)) {
              console.warn('Duplicate (similar):', newQ.question?.substring(0, 50));
              return false;
            }
          }

          return true;
        });

        // Update draft with new questions
        const updateResult = await DraftQuiz.findOneAndUpdate(
          { _id: id, 'chunks.chunkDetails.index': chunkIndex },
          {
            $push: { questions: { $each: newQuestions } },
            $set: {
              'chunks.chunkDetails.$.status': 'done',
              'chunks.chunkDetails.$.lockedAt': null,
              'chunks.chunkDetails.$.lockedBy': null,
              'chunks.chunkDetails.$.error': null,
            },
            $inc: { 'chunks.processed': 1 },
          },
          { new: true },
        );

        if (!updateResult) {
          throw new Error('Draft chunk update failed');
        }

        // Count done + error as "attempted"
        const doneCount = updateResult.chunks.chunkDetails.filter(
          (c: ChunkDetail) => c.status === 'done',
        ).length;

        const errorCount = updateResult.chunks.chunkDetails.filter(
          (c: ChunkDetail) => c.status === 'error',
        ).length;

        const allAttempted = doneCount + errorCount >= updateResult.chunks.total;
        const hasQuestions = updateResult.questions.length > 0;

        // Consider processing cycle complete once all chunk attempts finish.
        const isComplete = allAttempted;

        if (allAttempted) {
          const finalStatus = hasQuestions ? 'completed' : 'error';
          await DraftQuiz.updateOne(
            { _id: id },
            {
              $set: {
                status: finalStatus,
                'chunks.processed': doneCount,
              },
            },
          );
        }

        return apiOk({
          questions: newQuestions,
          progress: {
            processed: doneCount,
            total: updateResult.chunks.total,
            errors: errorCount,
            isComplete,
            totalQuestions: updateResult.questions.length,
          },
        });
      } catch (extractError: unknown) {
        const message = extractError instanceof Error ? extractError.message : 'Extraction failed';
        // Mark chunk as error
        await DraftQuiz.updateOne(
          { _id: id, 'chunks.chunkDetails.index': chunkIndex },
          {
            $set: {
              'chunks.chunkDetails.$.status': 'error',
              'chunks.chunkDetails.$.error': message,
              'chunks.chunkDetails.$.lockedAt': null,
              'chunks.chunkDetails.$.lockedBy': null,
            },
          },
        );

        return apiErr('internal_error', message, 500, {
          progress: {
            processed: draft.chunks.processed,
            total: draft.chunks.total,
            isComplete: false,
          },
        });
      }
    } catch (error) {
      logger.error({ error }, 'Process chunk error');
      return apiErr('internal_error', 'Failed to process chunk', 500);
    }
  },
);

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      // Remove multiple spaces
      .replace(/\s+/g, ' ')
      // Remove common punctuation variations
      .replace(/[.,;:!?'"()\[\]{}]/g, '')
      // Remove leading/trailing option markers (a., A), 1., etc.)
      .replace(/^[a-zA-Z0-9][.)\s]*/, '')
      // Normalize unicode
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  );
}

/**
 * Create a robust hash of question content to detect duplicates
 * Handles minor variations in formatting, punctuation, whitespace
 */
function hashQuestion(q: DraftQuestion): string {
  // Normalize question text
  const normalizedQuestion = normalizeText(q.question || '');

  // Normalize and sort options (order shouldn't matter for duplicate detection)
  const normalizedOptions = (q.options || [])
    .map((opt: string) => normalizeText(opt))
    .sort()
    .join('|||');

  return `${normalizedQuestion}:::${normalizedOptions}`;
}

/**
 * Check if two questions are similar (fuzzy match)
 */
function areSimilarQuestions(q1: DraftQuestion, q2: DraftQuestion): boolean {
  const text1 = normalizeText(q1.question || '');
  const text2 = normalizeText(q2.question || '');

  // If normalized texts are identical, they're duplicates
  if (text1 === text2) return true;

  // Check if one contains the other (for partial matches)
  if (text1.length > 20 && text2.length > 20) {
    if (text1.includes(text2) || text2.includes(text1)) {
      return true;
    }
  }

  return false;
}
