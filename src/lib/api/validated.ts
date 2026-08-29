import type { NextRequest, NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import {
  readAndValidateJson,
  readAndValidateRouteParams,
  type RouteParams,
  type ValidationResult,
} from '@/lib/api/request';
import { apiErr } from '@/lib/api/response';

interface ValidationFailureLike {
  error: string;
  fields: Record<string, string>;
}

export type ParsedResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

export type ParsedParamsAndBody<TParams, TBody> =
  | { ok: true; params: TParams; body: TBody }
  | { ok: false; response: NextResponse };

export interface ParamsAndBodySchemas<TParams, TBody> {
  params: ZodType<TParams>;
  body: ZodType<TBody>;
}

function validationFailure(result: ValidationFailureLike): NextResponse {
  return apiErr('validation_error', result.error, 400, { fields: result.fields });
}

function toParsed<T>(result: ValidationResult<T>): ParsedResult<T> {
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, response: validationFailure(result) };
}

export function parseRouteParams<TParams>(
  params: RouteParams,
  schema: ZodType<TParams>,
): ParsedResult<TParams> {
  return toParsed(readAndValidateRouteParams(params, schema));
}

export async function parseJsonBody<TBody>(
  request: NextRequest,
  schema: ZodType<TBody>,
): Promise<ParsedResult<TBody>> {
  return toParsed(await readAndValidateJson(request, schema));
}

export async function parseParamsAndBody<TParams, TBody>(
  request: NextRequest,
  params: RouteParams,
  schemas: ParamsAndBodySchemas<TParams, TBody>,
): Promise<ParsedParamsAndBody<TParams, TBody>> {
  const parsedParams = parseRouteParams(params, schemas.params);
  if (!parsedParams.ok) return parsedParams;
  const parsedBody = await parseJsonBody(request, schemas.body);
  if (!parsedBody.ok) return parsedBody;
  return { ok: true, params: parsedParams.data, body: parsedBody.data };
}
