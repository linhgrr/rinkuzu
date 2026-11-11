import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';

import { apiErr } from '@/lib/api/response';
import {
  QUIZ_TEXT_MAX_CHARS,
  QUIZ_TEXT_MIN_CHARS,
  QUIZ_TEXT_TOO_LONG,
  QUIZ_TEXT_TOO_SHORT,
} from '@/shared/constants/quiz-text-source';

/**
 * Bytes a text-draft body may have before it is read: 20,000 characters of 4-byte UTF-8
 * plus JSON escapes and the other fields fit well inside it.
 */
const MAX_TEXT_BODY_BYTES = 256 * 1024;

/** `guest_` on the guest route, so the browser can tell the two limits apart. */
type ReasonPrefix = '' | 'guest_';

function tooLong(prefix: ReasonPrefix): NextResponse {
  return apiErr('validation_error', 'Text is longer than the limit', 413, {
    reason: `${prefix}${QUIZ_TEXT_TOO_LONG}`,
    limit_chars: QUIZ_TEXT_MAX_CHARS,
  });
}

function tooShort(prefix: ReasonPrefix): NextResponse {
  return apiErr('validation_error', 'Text is shorter than the limit', 422, {
    reason: `${prefix}${QUIZ_TEXT_TOO_SHORT}`,
    limit_chars: QUIZ_TEXT_MIN_CHARS,
  });
}

export type QuizTextBody = { ok: true; body: unknown } | { ok: false; response: NextResponse };

/**
 * Reads a text-draft JSON body with a size ceiling. A body that is not JSON reads as
 * `null`, so the schema refuses it with a 400. The text is never logged.
 */
export async function readQuizTextBody(
  request: NextRequest,
  prefix: ReasonPrefix,
): Promise<QuizTextBody> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_TEXT_BODY_BYTES) return { ok: false, response: tooLong(prefix) };
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_TEXT_BODY_BYTES) {
    return { ok: false, response: tooLong(prefix) };
  }
  try {
    return { ok: true, body: JSON.parse(raw) as unknown };
  } catch {
    return { ok: true, body: null };
  }
}

/** The 422 / 413 for a text outside 200 to 20,000 characters; null for any other error. */
export function quizTextLengthRefusal(
  error: z.ZodError,
  prefix: ReasonPrefix,
): NextResponse | null {
  const textIssue = error.issues.find((issue) => issue.path[0] === 'text');
  if (textIssue?.message === QUIZ_TEXT_TOO_SHORT) return tooShort(prefix);
  if (textIssue?.message === QUIZ_TEXT_TOO_LONG) return tooLong(prefix);
  return null;
}
