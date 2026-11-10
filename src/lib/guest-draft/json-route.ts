import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import type { ZodType } from 'zod';

import type { ServiceResult } from '@/interfaces/services/types';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { parseJsonBody } from '@/lib/api/validated';

/**
 * A signed-out guest-draft POST (RIN-1446): the token rides in the JSON body, never in a
 * URL. Validates the body, runs the service call and maps its result to the envelope.
 */
export function guestDraftJsonRoute<TBody, TData>(
  schema: ZodType<TBody>,
  run: (body: TBody) => Promise<ServiceResult<TData>>,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request) => {
    const input = await parseJsonBody(request, schema);
    if (!input.ok) return input.response;
    const result = await run(input.data);
    return result.success ? apiOk(result.data) : apiServiceErr(result);
  };
}
